const rooms = require('../../data/rooms.json');
const rawBlockedDates = require('../../data/blocked-dates.json');

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfToday(referenceDate = new Date()) {
  return new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));
}

function nextUpcomingMonthDay(month, day, today) {
  let year = today.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, month - 1, day));

  while (candidate < today) {
    year += 1;
    candidate = new Date(Date.UTC(year, month - 1, day));
  }

  return formatIsoDate(candidate);
}

function normalizeBlockedDatesMap(map, referenceDate = new Date()) {
  const today = startOfToday(referenceDate);

  return Object.fromEntries(
    Object.entries(map || {}).map(([roomId, dates]) => {
      const normalized = Array.from(new Set(
        (dates || [])
          .map((value) => {
            const parsed = parseIsoDate(value);
            if (!parsed) return null;
            return nextUpcomingMonthDay(parsed.getUTCMonth() + 1, parsed.getUTCDate(), today);
          })
          .filter(Boolean)
      )).sort();

      return [roomId, normalized];
    })
  );
}

function nightsBetween(checkin, checkout) {
  return Math.round((checkout - checkin) / 86400000);
}

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getBookingQuote({ roomId, checkin, checkout, guests }, referenceDate = new Date()) {
  const room = rooms.find((entry) => entry.id === roomId);
  if (!room) throw createError('Unknown room.', 400);

  const checkinDate = parseIsoDate(checkin);
  const checkoutDate = parseIsoDate(checkout);
  if (!checkinDate || !checkoutDate) throw createError('Invalid booking dates.', 400);

  const today = startOfToday(referenceDate);
  if (checkinDate < today) throw createError('Check-in date must be today or later.', 400);

  const nights = nightsBetween(checkinDate, checkoutDate);
  if (nights < 1) throw createError('Check-out must be after check-in.', 400);

  const guestCount = parseInt(guests, 10);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > room.capacity) {
    throw createError('Guest count exceeds room capacity.', 400);
  }

  const blockedDates = normalizeBlockedDatesMap(rawBlockedDates, referenceDate)[roomId] || [];
  const blockedSet = new Set(blockedDates);

  for (let cursor = new Date(checkinDate); cursor < checkoutDate; cursor = addDays(cursor, 1)) {
    if (blockedSet.has(formatIsoDate(cursor))) {
      throw createError('Selected dates are not available.', 409);
    }
  }

  return {
    room,
    guests: guestCount,
    nights,
    total: nights * room.price,
    blockedDates
  };
}

module.exports = {
  getBookingQuote,
  normalizeBlockedDatesMap
};
