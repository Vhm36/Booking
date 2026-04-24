const normalizeTimeString = (value) => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [hours, minutes] = raw.split(':').map((part) => Number(part));
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    const [hours, minutes, seconds] = raw.split(':').map((part) => Number(part));
    if (
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59 &&
      seconds >= 0 &&
      seconds <= 59
    ) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  return null;
};

const addMinutesToTimeString = (value, minutesToAdd) => {
  const normalized = normalizeTimeString(value);
  const safeMinutesToAdd = Number(minutesToAdd);

  if (!normalized || !Number.isFinite(safeMinutesToAdd)) {
    return null;
  }

  const [hours, minutes, seconds] = normalized.split(':').map((part) => Number(part));
  const totalMinutes = hours * 60 + minutes + safeMinutesToAdd;

  if (totalMinutes < 0 || totalMinutes > 24 * 60) {
    return null;
  }

  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;

  if (nextHours > 23 || (nextHours === 24 && (nextMinutes !== 0 || seconds !== 0))) {
    return null;
  }

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const toShortTimeString = (value) => {
  const normalized = normalizeTimeString(value);
  return normalized ? normalized.slice(0, 5) : '';
};

module.exports = {
  normalizeTimeString,
  addMinutesToTimeString,
  toShortTimeString
};
