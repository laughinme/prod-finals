export function getAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function formatDate(iso: string | null | undefined, locale: string = 'en-US'): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );
}
