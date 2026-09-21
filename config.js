/* ================================================================
   WE ARE LEGEND — MEMBER PORTAL CONFIG
   Points at the same Apps Script Web App used by the admin
   dashboard and the public Member Lookup site, so all three read
   and write the same Google Sheet.
   ================================================================ */

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxHBlXcIReDPnA55L2vdU2KJF2osooAxCPXfvsJojLOzAG7eDzw1CjpL56_gkyDobpiNg/exec",
  APP_NAME: "WE ARE LEGEND",
  ESTABLISHED_DATE: "2023-06-17",
  // Same value as MEMBER_LOOKUP_URL in the admin dashboard's config.js —
  // used to build the QR code on "My ID Card".
  MEMBER_LOOKUP_URL: "https://subhajit-god.github.io/we-are-legend-member-lookup"
};
