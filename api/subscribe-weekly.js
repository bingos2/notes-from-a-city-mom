// Legacy email links used this endpoint. Keep them safe: opening a link never subscribes anyone.
export default function handler(req, res) {
  const query = new URLSearchParams();
  for (const key of ['e', 'x', 's']) {
    if (req.query?.[key]) query.set(key, String(req.query[key]));
  }
  return res.redirect(302, '/weekly-note?' + query.toString());
}
