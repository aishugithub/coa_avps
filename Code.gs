/**
 * ============================================================================
 * AVPS ASSIGNMENT — Google Apps Script backend (Code.gs)
 * ============================================================================
 * WHAT THIS IS (big picture):
 * This is the tiny server that receives each student's submission from the
 * assignment web page (index.html on GitHub Pages) and writes it as ONE ROW in
 * your Google Sheet. It is bound to the Sheet and published as a "Web App" with
 * a public URL; the web page POSTs JSON to that URL.
 *
 * DATA FLOW:
 *   [index.html on GitHub Pages]  --POST JSON (text/plain)-->  doPost(e)  -->  Sheet row
 *
 * The web page sends a "simple" text/plain POST (no CORS preflight), so this
 * script does not need to emit any CORS headers — it just reads the JSON body
 * from e.postData.contents, appends a row, and returns a small JSON ack.
 *
 * COLUMN LAYOUT (kept stable so analysis is easy):
 *   Part A — identity & assignment, then the three sections' 7 answers each,
 *   Part B — feedback fields, kept AFTER all the structured answers.
 * The HEADERS array below is the single source of truth for both the header
 * row and the order of every data row. If you add a question, add its key here.
 * ============================================================================
 */

// The tab name inside the Spreadsheet where rows are written. Created if absent.
var SHEET_NAME = 'Responses';

// The exact column order. Each entry is a key we expect in the posted JSON
// (except 'submittedAt' and the identity fields, which are always present).
// KEEPING PART A (structured answers) SEPARATE FROM PART B (feedback), as agreed.
var HEADERS = [
  // ---- identity & assignment (Part A header block) ----
  'submittedAt', 'regno', 'name', 'sessionId',
  'rawSet', 'luSet', 'controlSet',
  // ---- Section 1: Data hazard (RAW) ----
  'raw_q1_predType', 'raw_q2_conf', 'raw_q3_predStall', 'raw_q4_depReg',
  'raw_q5_actStall', 'raw_q6_tricky', 'raw_q7_method',
  // ---- Section 2: Load-use ----
  'lu_q1_predType', 'lu_q2_conf', 'lu_q3_predStall', 'lu_q4_depReg',
  'lu_q5_actStall', 'lu_q6_tricky', 'lu_q7_method',
  // ---- Section 3: Control ----
  'ctrl_q1_predType', 'ctrl_q2_conf', 'ctrl_q3_predPen', 'ctrl_q4_stage',
  'ctrl_q5_actPen', 'ctrl_q6_tricky', 'ctrl_q7_method',
  // ---- Part B: feedback (kept after all structured answers) ----
  'fb_useful', 'fb_tutor', 'fb_vsgeneric', 'fb_comment',
  // ---- diagnostics ----
  'userAgent'
];

/**
 * doPost(e) — called automatically when the web page POSTs a submission.
 * @param {Object} e - the event; e.postData.contents holds the JSON string.
 * @return {TextOutput} a small JSON ack (the page doesn't read it under no-cors,
 *   but returning JSON is correct and useful when you test the URL directly).
 */
function doPost(e) {
  // A lock stops two simultaneous submissions from interleaving their writes
  // (with 400 students, several may hit "Submit" in the same second).
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // wait up to 30s for our turn
  try {
    // Parse the JSON the page sent. If it's missing/garbled, record nothing and
    // return an error ack.
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'no post body' });
    }
    var data = JSON.parse(e.postData.contents);

    // Get (or lazily create) the target sheet and make sure the header row
    // exists exactly once, in the order defined by HEADERS.
    var sheet = getSheet_();

    // Build the row in HEADERS order. Missing keys become '' so columns align.
    var row = HEADERS.map(function (key) {
      var v = data[key];
      return (v === undefined || v === null) ? '' : v;
    });
    sheet.appendRow(row);

    return json({ ok: true, wrote: sheet.getLastRow() });
  } catch (err) {
    // Never throw back to the browser; log for you and ack the failure.
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * doGet(e) — a convenience so that visiting the Web App URL in a browser shows
 * a friendly "it's alive" message instead of an error. Not used by the form.
 */
function doGet() {
  return json({ ok: true, message: 'AVPS assignment endpoint is live. Submissions are POSTed by the assignment page.' });
}

/**
 * getSheet_() — returns the 'Responses' sheet, creating it and writing the
 * header row the first time. The trailing underscore marks it private-by-
 * convention (not callable as a Web App entry point).
 */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Write headers if the sheet is empty (first ever run).
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);           // keep headers visible while scrolling
  }
  return sheet;
}

/**
 * json(obj) — helper to return an object as a JSON HTTP response.
 */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
