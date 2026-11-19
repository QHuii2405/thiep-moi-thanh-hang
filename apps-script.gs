/**
 * Google Apps Script - Webhook Backend cho Thiệp Mời Online
 * Chủ sự kiện: Vũ Lâm Thanh Hằng - Lễ Tốt Nghiệp NLU
 * Xử lý: doGet (lấy lời chúc), doPost (gửi lời chúc, RSVP, thả tim)
 * Hỗ trợ LockService để tránh xung đột dữ liệu đồng thời.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getWishes';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getWishes') {
    var sheet = getOrCreateSheet(ss, 'Wishes', ['id', 'name', 'message', 'time', 'likes']);
    var data = sheet.getDataRange().getValues();
    var wishes = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        wishes.push({
          id: String(row[0]),
          name: String(row[1] || 'Khách mời'),
          message: String(row[2] || ''),
          time: String(row[3] || ''),
          likes: parseInt(row[4], 10) || 0
        });
      }
    }
    
    return createJsonResponse({
      status: 'success',
      data: wishes,
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'getRSVP') {
    var rsvpSheet = getOrCreateSheet(ss, 'RSVP', ['timestamp', 'name', 'phone', 'attendance', 'guests', 'device']);
    var rData = rsvpSheet.getDataRange().getValues();
    var rsvps = [];
    for (var j = 1; j < rData.length; j++) {
      var rRow = rData[j];
      if (rRow[1]) {
        rsvps.push({
          timestamp: rRow[0],
          name: rRow[1],
          phone: rRow[2],
          attendance: rRow[3],
          guests: rRow[4],
          device: rRow[5]
        });
      }
    }
    return createJsonResponse({
      status: 'success',
      data: rsvps
    });
  }

  return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Đợi tối đa 10s để kiểm soát đồng thời
  } catch (err) {
    return createJsonResponse({ status: 'error', message: 'Server is busy, please retry.' });
  }

  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (ex) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var action = postData.action || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'addWish') {
      var name = (postData.name || '').trim();
      var message = (postData.message || '').trim();
      if (!name || !message) {
        return createJsonResponse({ status: 'error', message: 'Tên và lời chúc không được để trống.' });
      }

      var sheet = getOrCreateSheet(ss, 'Wishes', ['id', 'name', 'message', 'time', 'likes']);
      var id = 'wish_' + Utilities.getUuid().slice(0, 8);
      var timeStr = postData.time || Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
      var likes = 0;

      sheet.appendRow([id, name, message, timeStr, likes]);
      return createJsonResponse({
        status: 'success',
        data: { id: id, name: name, message: message, time: timeStr, likes: likes }
      });
    }

    if (action === 'likeWish') {
      var wishId = postData.id;
      if (!wishId) {
        return createJsonResponse({ status: 'error', message: 'Missing wish id' });
      }

      var sheet = getOrCreateSheet(ss, 'Wishes', ['id', 'name', 'message', 'time', 'likes']);
      var data = sheet.getDataRange().getValues();
      var found = false;
      var newLikes = 0;

      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(wishId)) {
          newLikes = (parseInt(data[i][4], 10) || 0) + 1;
          sheet.getRange(i + 1, 5).setValue(newLikes);
          found = true;
          break;
        }
      }

      if (found) {
        return createJsonResponse({ status: 'success', id: wishId, likes: newLikes });
      } else {
        return createJsonResponse({ status: 'error', message: 'Wish not found', id: wishId });
      }
    }

    if (action === 'addRSVP') {
      var rName = (postData.name || '').trim();
      if (!rName) {
        return createJsonResponse({ status: 'error', message: 'Vui lòng nhập tên của bạn.' });
      }

      var rsvpSheet = getOrCreateSheet(ss, 'RSVP', ['timestamp', 'name', 'phone', 'attendance', 'guests', 'device']);
      var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
      rsvpSheet.appendRow([
        now,
        rName,
        postData.phone || '',
        postData.attendance || 'yes',
        postData.guests || 1,
        postData.device || ''
      ]);

      return createJsonResponse({
        status: 'success',
        message: 'Cảm ơn bạn đã phản hồi tham dự!'
      });
    }

    return createJsonResponse({ status: 'error', message: 'Unsupported action: ' + action });

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
  }
  return sheet;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
