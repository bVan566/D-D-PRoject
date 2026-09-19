// Job records live separately from the PC -- PC only ever holds active_job_id.
// No generator yet; callers hard-code a Job for Slice 1.

function newJob({ id, fixer_id, site_stamp, pay, fail_burn, attention_risk, status = "offered" }) {
  return { id, fixer_id, site_stamp, pay, fail_burn, attention_risk, status };
}

module.exports = { newJob };
