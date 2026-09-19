/**
 * ============================================================================
 * AVPS ASSIGNMENT — Google Apps Script backend (Code.gs, v2 with auto-scoring)
 * ============================================================================
 * WHAT THIS IS:
 * The server that receives each submission from index.html and writes it as ONE
 * ROW in your Google Sheet — AND auto-scores the 5 factual MCQs in each of the
 * three sections against a verified answer key, so you get per-section and total
 * scores automatically.
 *
 * DATA FLOW:
 *   [index.html on GitHub Pages] --POST JSON--> doPost(e) --score--> Sheet row
 *
 * HOW SCORING KNOWS THE RIGHT ANSWER:
 * The page tells us exactly which item each student got (dataItem/loadItem/
 * controlItem, e.g. "ex2", "RAW-3", "ex4"). The ANSWER_KEY below — verified
 * against the actual simulator behaviour — maps each item to its correct
 * answers. Because some built-ins forward (0 stalls) and others stall, the key
 * is per-item, never a single blanket answer.
 *
 * IMPORTANT — the correct-answer TEXT here must match the option TEXT in
 * index.html character-for-character, or a right answer would be scored wrong.
 * If you edit an option's wording in the page, update it here too.
 * ============================================================================
 */

var SHEET_NAME = 'Responses';

/* ---- Answer keys, verified from the simulator ---------------------------- */

// Which register carries the dependency, per custom program (= the register the
// 2nd instruction reads from the 1st). Built-in examples ex2/ex3 both use x2.
var RAW_DEP = { 'RAW-1':'x5','RAW-2':'x8','RAW-3':'x11','RAW-4':'x14','RAW-5':'x17',
                'RAW-6':'x20','RAW-7':'x23','RAW-8':'x26','RAW-9':'x29','RAW-10':'x5' };
var LU_DEP  = { 'LU-1':'x5','LU-2':'x9','LU-3':'x13','LU-4':'x17','LU-5':'x21',
                'LU-6':'x25','LU-7':'x29','LU-8':'x9','LU-9':'x13','LU-10':'x17' };
// Control built-ins: resolve stage + number of flushed instructions.
var CONTROL_KEY = {
  'ex4':  { resolve:'Execute', flush:'2' },
  'ex5':  { resolve:'Decode',  flush:'1' },
  'pat4': { resolve:'Decode',  flush:'1' }
};

// Fixed (item-independent) correct answers for the concept questions.
var DATA_FIXED = {
  q1:'Data hazard (RAW)', q3:'0',
  q4:'Forwarding from the ALU (EX) stage',
  q5:'Forwarding sends the result straight to the next instruction'
};
var LOAD_FIXED = {
  q1:'Load-use hazard', q3:'1',
  q4:"The load's memory (MEM) stage",
  q5:'The loaded value is ready only after MEM — one cycle late'
};
var CONTROL_FIXED = {
  q1:'Control hazard',
  q4:'They were fetched before the branch outcome was known',
  q5:'Decrease'
};

/**
 * correctAnswersFor(family, itemId) -> { q1..q5 } the verified correct answers.
 * itemId is 'ex2'/'ex3'/'ex4'/'ex5'/'pat4' for built-ins, or 'RAW-k'/'LU-k'.
 */
function correctAnswersFor(family, itemId) {
  if (family === 'data') {
    var dep = (itemId === 'ex2') ? 'x2' : (RAW_DEP[itemId] || '');
    return { q1:DATA_FIXED.q1, q2:dep, q3:DATA_FIXED.q3, q4:DATA_FIXED.q4, q5:DATA_FIXED.q5 };
  }
  if (family === 'load') {
    var d = (itemId === 'ex3') ? 'x2' : (LU_DEP[itemId] || '');
    return { q1:LOAD_FIXED.q1, q2:d, q3:LOAD_FIXED.q3, q4:LOAD_FIXED.q4, q5:LOAD_FIXED.q5 };
  }
  // control
  var c = CONTROL_KEY[itemId] || { resolve:'', flush:'' };
  return { q1:CONTROL_FIXED.q1, q2:c.resolve, q3:c.flush, q4:CONTROL_FIXED.q4, q5:CONTROL_FIXED.q5 };
}

/**
 * scoreSection(data, family, sectionKey, itemId) -> number correct out of 5.
 * data       = the parsed submission
 * sectionKey = 'data' | 'load' | 'control' (the answer field prefix)
 */
function scoreSection(data, family, sectionKey, itemId) {
  var key = correctAnswersFor(family, itemId);
  var n = 0;
  ['q1','q2','q3','q4','q5'].forEach(function (q) {
    var got = data[sectionKey + '_' + q];
    if (got !== undefined && got !== null && String(got) === String(key[q])) n++;
  });
  return n;
}

/* ---- Column order (single source of truth for header + every data row) ---- */
var HEADERS = [
  // identity & assignment (Part A)
  'submittedAt','regno','name','sessionId','group','order',
  'dataMode','dataItem','loadMode','loadItem','controlItem',
  // Section: Data (answers)
  'data_q1','data_q2','data_q3','data_q4','data_q5','data_help',
  // Section: Load
  'load_q1','load_q2','load_q3','load_q4','load_q5','load_help',
  // Section: Control
  'control_q1','control_q2','control_q3','control_q4','control_q5','control_help',
  // auto-scores (out of 5 each; total out of 15)
  'data_score','load_score','control_score','total_score',
  // feedback (Part B) + diagnostics
  'fb_vsgeneric','fb_comment','userAgent'
];

/**
 * doPost(e) — receive a submission, score it, append the row.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ ok:false, error:'no post body' });
    var data = JSON.parse(e.postData.contents);

    // --- auto-score the three sections against the verified key ---
    var dScore = scoreSection(data, 'data',    'data',    data.dataItem);
    var lScore = scoreSection(data, 'load',    'load',    data.loadItem);
    var cScore = scoreSection(data, 'control', 'control', data.controlItem);
    data.data_score = dScore;
    data.load_score = lScore;
    data.control_score = cScore;
    data.total_score = dScore + lScore + cScore;   // out of 15

    var sheet = getSheet_();
    var row = HEADERS.map(function (k) { var v = data[k]; return (v === undefined || v === null) ? '' : v; });
    sheet.appendRow(row);
    return json({ ok:true, wrote:sheet.getLastRow(), total:data.total_score });
  } catch (err) {
    return json({ ok:false, error:String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok:true, message:'AVPS assignment endpoint is live. Submissions are POSTed by the assignment page.' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) { sheet.appendRow(HEADERS); sheet.setFrozenRows(1); }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
