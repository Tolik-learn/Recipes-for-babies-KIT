// columns in "Form Responses 1": A=Timestamp, B=Email Address, C=שם מלא, D=Email, E=Approved, F=Token, G=מחיקה (checkbox)
var SHEET_NAME = 'Form Responses 1';
var USERDATA_SHEET_NAME = 'UserData';
var OWNER_EMAIL = 'tolik.davidov@gmail.com';
var GOOGLE_CLIENT_ID = '843570895037-4hduefa8p8aacp7iehsrq203iekd895t.apps.googleusercontent.com';
var DELETE_COL = 7; // column G

var TELEGRAM_BOT_TOKEN = '8836137037:AAGm6t_Qhippp0_b69zXGZ1nNP1djW1miK4';
var TELEGRAM_CHAT_ID = '1317112045';

// ---- checkbox-driven deletion straight from the sheet ----
function onEdit(e) {
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  // checkbox in H1 = delete all
  if (e.range.getA1Notation() === 'H1' && e.range.getValue() === true) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    sheet.getRange('H1').setValue(false); // reset
    return;
  }

  if (e.range.getColumn() !== DELETE_COL) return;
  if (e.range.getValue() !== true) return;

  var row = e.range.getRow();

  if (row === 1) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    sheet.getRange(1, DELETE_COL).setValue(false);
  } else {
    sheet.deleteRow(row);
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === 'saveUserData') {
    return saveUserData_(data);
  }

  // ---- default: access request ----
  var sheet = getSheet_();
  var email = String(data.email || '').toLowerCase().trim();
  var name = data.name || '';

  var values = sheet.getDataRange().getValues();
  var token = null;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][3]).toLowerCase().trim() === email) { token = values[i][5]; break; }
  }

  if (!token && email) {
    token = Utilities.getUuid();
    var newRow = sheet.getLastRow() + 1;
    sheet.appendRow([new Date(), '', name, email, false, token]);
    sheet.getRange(newRow, 5).setValue(false);           // NEW: force Approved=false, in case the smart table auto-fills a default
    sheet.getRange(newRow, DELETE_COL).insertCheckboxes(); // keep the delete checkbox on new rows too

    var webAppUrl = ScriptApp.getService().getUrl();
    var approveUrl = webAppUrl + '?action=approve&token=' + token;
    var notifySettings = getNotifySettings_();            // NEW

    if (notifySettings.email) {                            // NEW
      try {
        MailApp.sendEmail({
          to: OWNER_EMAIL,
          subject: 'Recipe site - new access request',
          htmlBody:
            'New request from: <b>' + name + '</b> (' + email + ')<br><br>' +
            '<a href="' + approveUrl + '" ' +
            'style="background:#B4714B;color:#fff;padding:12px 24px;border-radius:999px;' +
            'text-decoration:none;font-family:sans-serif;font-weight:bold;display:inline-block;">' +
            'Approve access - one click' +
            '</a><br><br>' +
            'Or manage from your admin page.'
        });
      } catch (err) {}
    }                                                       // NEW

    if (notifySettings.telegram) {                          // NEW
      try {
        sendTelegramMessage_(
          '🔔 New access request\n\n' +
          'Name: ' + name + '\n' +
          'Email: ' + email + '\n\n' +
          'Approve: ' + approveUrl
        );
      } catch (err) {}
    }                                                       // NEW
  }

  return jsonOut_({ status: 'ok', token: token });
}

function sendTelegramMessage_(text) {
  var url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      disable_web_page_preview: true   // NEW: stop Telegram from auto-fetching (and thereby auto-approving) the link
    }),
    muteHttpExceptions: true
  });
}

function doGet(e) {
  var action = e.parameter.action;

  // NEW: GET only ever shows a confirmation screen - it must have zero side
  // effects, because GET requests can be triggered automatically by link
  // previews (Telegram, Gmail, etc) without any human decision.
  if (action === 'approve' && e.parameter.token) {
    return showApproveConfirmPage_(e.parameter.token);
  }

  // NEW: this is the action that actually flips Approved=true. It is only
  // ever called by a real button click (via fetch() in the confirm page),
  // never by a bot/crawler prefetching a link, since those don't run JS.
  if (action === 'confirmApprove' && e.parameter.token) {
    return handleConfirmApprove_(e.parameter.token);
  }

  if (action === 'deleteRequest' && e.parameter.token) {
    return deleteByToken_(e.parameter.token);
  }

  if (action === 'deleteAllLink') {
    return deleteAllRequests_();
  }

  if (action === 'getUserData') {
    return getUserData_(String(e.parameter.email || ''));
  }

  if (action === 'list') {
    if (!verifyAdmin_(e.parameter.idtoken)) return jsonOut_({ error: 'unauthorized' });
    return listRequests_();
  }

  if (action === 'setApproval') {
    if (!verifyAdmin_(e.parameter.idtoken)) return jsonOut_({ error: 'unauthorized' });
    return setApproval_(e.parameter.row, e.parameter.value === 'true');
  }

  // NEW: admin-only, fully deletes the row instead of just flipping Approved to false
  if (action === 'revokeAccess') {
    if (!verifyAdmin_(e.parameter.idtoken)) return jsonOut_({ error: 'unauthorized' });
    return revokeAccess_(e.parameter.row);
  }

  // NEW: admin-only, read current notification toggle state
  if (action === 'getSettings') {
    if (!verifyAdmin_(e.parameter.idtoken)) return jsonOut_({ error: 'unauthorized' });
    return jsonOut_(getNotifySettings_());
  }

  // NEW: admin-only, update notification toggle state
  if (action === 'setSettings') {
    if (!verifyAdmin_(e.parameter.idtoken)) return jsonOut_({ error: 'unauthorized' });
    return setNotifySettings_(e.parameter.email === 'true', e.parameter.telegram === 'true');
  }

  var email = String((e.parameter.email || '')).toLowerCase().trim();
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var approved = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][3]).toLowerCase().trim() === email && values[i][4] === true) {
      approved = true;
      break;
    }
  }
  return jsonOut_({ approved: approved });
}

function verifyAdmin_(idToken) {
  if (!idToken) return false;
  try {
    var resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return false;
    var info = JSON.parse(resp.getContentText());
    return info.aud === GOOGLE_CLIENT_ID &&
      info.email &&
      info.email.toLowerCase() === OWNER_EMAIL.toLowerCase() &&
      info.email_verified === 'true';
  } catch (err) {
    return false;
  }
}

function saveUserData_(data) {
  var email = String(data.email || '').toLowerCase().trim();
  if (!email) return jsonOut_({ status: 'error' });
  var sheet = getUserDataSheet_();
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase().trim() === email) { rowIndex = i + 1; break; }
  }
  var favJson = JSON.stringify(data.favorites || []);
  var recentJson = JSON.stringify(data.recent || []);
  if (rowIndex === -1) {
    sheet.appendRow([email, favJson, recentJson, new Date()]);
  } else {
    sheet.getRange(rowIndex, 2, 1, 3).setValues([[favJson, recentJson, new Date()]]);
  }
  return jsonOut_({ status: 'ok' });
}

function getUserData_(email) {
  email = String(email || '').toLowerCase().trim();
  var sheet = getUserDataSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase().trim() === email) {
      var favorites = [];
      var recent = [];
      try { favorites = JSON.parse(values[i][1] || '[]'); } catch (err) {}
      try { recent = JSON.parse(values[i][2] || '[]'); } catch (err) {}
      return jsonOut_({ favorites: favorites, recent: recent });
    }
  }
  return jsonOut_({ favorites: [], recent: [] });
}

function deleteByToken_(token) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][5]) === token) {
      sheet.deleteRow(i + 1);
      return jsonOut_({ status: 'deleted' });
    }
  }
  return jsonOut_({ status: 'not_found' });
}

function deleteAllRequests_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  return jsonOut_({ status: 'deleted_all' });
}

function listRequests_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][3]) continue;
    out.push({
      row: i + 1,
      timestamp: values[i][0],
      name: values[i][2],
      email: values[i][3],
      approved: values[i][4] === true
    });
  }
  return jsonOut_(out);
}

function setApproval_(row, value) {
  var sheet = getSheet_();
  sheet.getRange(Number(row), 5).setValue(value);
  return jsonOut_({ status: 'ok' });
}

function revokeAccess_(row) {
  var sheet = getSheet_();
  sheet.deleteRow(Number(row));
  return jsonOut_({ status: 'revoked' });
}

// NEW: read-only screen - safe to be hit automatically by link previews,
// since it never changes the sheet.
function showApproveConfirmPage_(token) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var matchedRow = -1;
  var matchedName = '';
  var alreadyApproved = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][5]) === token) {
      matchedRow = i + 1;
      matchedName = values[i][2];
      alreadyApproved = values[i][4] === true;
      break;
    }
  }

  var webAppUrl = ScriptApp.getService().getUrl();
  var confirmUrl = webAppUrl + '?action=confirmApprove&token=' + encodeURIComponent(token);

  var html;
  if (matchedRow === -1) {
    html = '<div style="font-family:sans-serif;text-align:center;padding:60px 20px;">' +
      '<h2>Link is invalid or already used</h2></div>';
  } else if (alreadyApproved) {
    html = '<div style="font-family:sans-serif;text-align:center;padding:60px 20px;">' +
      '<h2 style="color:#7E9A72;">Access already approved for ' + matchedName + '</h2>' +
      '<p>You can close this window.</p></div>';
  } else {
    html =
      '<div style="font-family:sans-serif;text-align:center;padding:60px 20px;" id="wrap">' +
      '<h2>Approve access for ' + matchedName + '?</h2>' +
      '<button id="approveBtn" style="background:#B4714B;color:#fff;padding:14px 32px;border:none;' +
      'border-radius:999px;font-size:16px;font-weight:bold;cursor:pointer;">Yes, approve</button>' +
      '<p id="msg" style="margin-top:16px;color:#7E9A72;"></p>' +
      '</div>' +
      '<script>' +
      'document.getElementById("approveBtn").addEventListener("click", function(){' +
      '  this.disabled = true;' +
      '  this.textContent = "Approving...";' +
      '  fetch("' + confirmUrl + '")' +
      '    .then(function(r){ return r.json(); })' +
      '    .then(function(data){' +
      '      document.getElementById("wrap").innerHTML = "<h2 style=\\"color:#7E9A72;\\">Approved ✅</h2><p>You can close this window.</p>";' +
      '    })' +
      '    .catch(function(){' +
      '      document.getElementById("msg").textContent = "Something went wrong, try again.";' +
      '      document.getElementById("approveBtn").disabled = false;' +
      '      document.getElementById("approveBtn").textContent = "Yes, approve";' +
      '    });' +
      '});' +
      '</script>';
  }
  return HtmlService.createHtmlOutput(html);
}

// NEW: the only place that actually flips Approved=true. Only reachable via
// a real fetch() triggered by a button click in showApproveConfirmPage_.
function handleConfirmApprove_(token) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var matchedRow = -1;
  var matchedName = '';
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][5]) === token) { matchedRow = i + 1; matchedName = values[i][2]; break; }
  }
  if (matchedRow === -1) {
    return jsonOut_({ status: 'not_found' });
  }
  sheet.getRange(matchedRow, 5).setValue(true);
  try {
    sendTelegramMessage_('✅ Approved: ' + matchedName);
  } catch (err) {}
  return jsonOut_({ status: 'approved' });
}

// NEW: notification channel toggles, persisted in Script Properties
// (not tied to any one sheet row, survives sheet edits)
function getNotifySettings_() {
  var props = PropertiesService.getScriptProperties();
  var emailVal = props.getProperty('NOTIFY_EMAIL');
  var telegramVal = props.getProperty('NOTIFY_TELEGRAM');
  return {
    email: emailVal === null ? true : emailVal === 'true',       // default ON
    telegram: telegramVal === null ? true : telegramVal === 'true' // default ON
  };
}

function setNotifySettings_(emailOn, telegramOn) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('NOTIFY_EMAIL', String(!!emailOn));
  props.setProperty('NOTIFY_TELEGRAM', String(!!telegramOn));
  return jsonOut_({ status: 'ok', email: !!emailOn, telegram: !!telegramOn });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp', 'Email Address', 'Full Name', 'Email', 'Approved', 'Token', 'מחיקה']);
  }
  return sheet;
}

function getUserDataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USERDATA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERDATA_SHEET_NAME);
    sheet.appendRow(['Email', 'Favorites', 'Recent', 'UpdatedAt']);
  }
  return sheet;
}
