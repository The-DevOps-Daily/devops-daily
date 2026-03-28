/** Brevo subscription form URL. Public — safe to commit, no env var needed. */
export const BREVO_FORM_URL =
  'https://66ce6dcc.sibforms.com/serve/MUIFABg_VUzhY-5kln8REbgjz0epYq6FtPckqwqsIG_s4FKBiVUqR9Q5SakKep9c2cHa2NEC1J02ps4tMUbaxssoB7MvwSggRvWktJJ7-LM9oWVRG3h0KhFHXsNOgoCSEo9OTB_CIp8JyRlALoSmEQOGpRoVYIYEq2LD0ikQ6T56zXVF8ZNc3tFBykMZGOxtLEfD7tap75LwptWPxg==';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Submit an email to the Brevo hosted subscription form.
 * Uses mode:'no-cors' because Brevo's endpoint doesn't emit CORS headers.
 * The response is opaque, so any non-throwing fetch is treated as success.
 */
export async function submitToBrevo(email: string): Promise<void> {
  const body = new URLSearchParams({
    EMAIL: email.trim(),
    email_address_check: '',
    locale: 'en',
  });
  await fetch(BREVO_FORM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    mode: 'no-cors',
  });
}
