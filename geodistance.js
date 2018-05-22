const calcArc = angle => angle * Math.PI / 180;
const calcSin2 = x => Math.pow(Math.sin(x), 2);

module.exports = (location1, location2) => {
  const { lat: lat1, lng: lng1 } = location1;
  const { lat: lat2, lng: lng2 } = location2;
  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return null;
  }
  const radius = 6371e3; // Earth radius
  const phi1 = calcArc(lat1);
  const lambda1 = calcArc(lng1);
  const phi2 = calcArc(lat2);
  const lambda2 = calcArc(lng2);
  const deltaPhi = phi2 - phi1;
  const deltaLambda = lambda2 - lambda1;

  const a = calcSin2(deltaPhi/2) + Math.cos(phi1) * Math.cos(phi2) * calcSin2(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
};