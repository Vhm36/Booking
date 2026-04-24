const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    return trimmed.split(',');
  }

  if (value === null || typeof value === 'undefined') {
    return [];
  }

  return [value];
};

const normalizeSelectedServiceIds = (...sources) => {
  const seen = new Set();
  const normalized = [];

  sources.forEach((source) => {
    toArray(source).forEach((item) => {
      const parsedId = Number(item);
      if (!Number.isInteger(parsedId) || parsedId <= 0 || seen.has(parsedId)) {
        return;
      }

      seen.add(parsedId);
      normalized.push(parsedId);
    });
  });

  return normalized;
};

const summarizeSelectedServices = (services) =>
  (Array.isArray(services) ? services : []).reduce(
    (summary, service) => {
      summary.totalDuration += Number(service?.duration) || 0;
      summary.totalPrice += Number(service?.price) || 0;
      return summary;
    },
    {
      totalDuration: 0,
      totalPrice: 0
    }
  );

module.exports = {
  normalizeSelectedServiceIds,
  summarizeSelectedServices
};
