/**
 * Centralized Date & Time formatting for India Standard Time (IST / GMT+5:30).
 * Ensures all audit logs, activity feeds, and document timestamps display in IST.
 */

const normalizeToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  let str = String(value).trim();
  // If no timezone offset is present in ISO string, treat as UTC
  if (!str.endsWith('Z') && !str.includes('+') && !/-\d\d:\d\d$/.test(str)) {
    str += 'Z';
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Full date and time in IST
 * Example: "23 Oct 2026, 10:58:30 PM IST"
 */
export const formatIST = (value, includeSeconds = true) => {
  const d = normalizeToDate(value);
  if (!d) return 'N/A';

  const options = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  if (includeSeconds) {
    options.second = '2-digit';
  }

  return `${d.toLocaleString('en-IN', options)} IST`;
};

/**
 * Time only in IST
 * Example: "10:58 PM IST"
 */
export const formatISTTime = (value) => {
  const d = normalizeToDate(value);
  if (!d) return 'N/A';

  return `${d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })} IST`;
};

/**
 * Date only in IST
 * Example: "23 Oct 2026"
 */
export const formatISTDate = (value) => {
  const d = normalizeToDate(value);
  if (!d) return 'N/A';

  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
