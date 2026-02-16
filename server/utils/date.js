const formatIndianDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // DD/MM/YYYY
};

const formatIndianDateTime = (date) => {
  const d = new Date(date);
  const dateStr = formatIndianDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`; // DD/MM/YYYY HH:MM
};

const getCurrentIndianDate = () => {
  return formatIndianDate(new Date());
};

const getCurrentIndianDateTime = () => {
  return formatIndianDateTime(new Date());
};

const getTodayIST = () => {
  const now = new Date();
  // IST is UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
};

export { formatIndianDate, formatIndianDateTime, getCurrentIndianDate, getCurrentIndianDateTime, getTodayIST };
