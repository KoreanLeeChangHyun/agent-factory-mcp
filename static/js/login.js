const loginForm = document.querySelector("[data-login-form]");
const loginError = document.querySelector("[data-login-error]");
const googleLogin = document.querySelector("[data-google-login]");
const passwordLoginDivider = document.querySelector("[data-password-login-divider]");
const rootPath = new URL("../", document.baseURI).pathname.replace(/\/$/, "");
for (const [name,label] of [['email','이메일'],['password','비밀번호']]) {
  const control = loginForm?.elements[name];
  if (control) {
    const caption = control.closest('label');
    caption.replaceWith(window.agentFactoryAuthUI.fieldFor({label,control}).root);
  }
}

const api = async (path, options = {}) => {
  const response = await fetch(`${rootPath}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(
      payload.error?.message || payload.message || response.statusText || "요청에 실패했습니다.",
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
};

const loadAuthProviders = async () => {
  try {
    const payload = await api("/api/auth/providers");
    const googleEnabled = Array.isArray(payload.providers) && payload.providers.includes("google");
    if (googleLogin) googleLogin.hidden = !googleEnabled;
    if (passwordLoginDivider) passwordLoginDivider.hidden = !googleEnabled;
  } catch {
    if (googleLogin) googleLogin.hidden = true;
    if (passwordLoginDivider) passwordLoginDivider.hidden = true;
  }
};

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  submit.setAttribute("aria-busy", "true");
  if (loginError) loginError.textContent = "";
  const formData = new FormData(loginForm);
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    window.location.assign(`${rootPath}/workspace/`);
  } catch (error) {
    if (loginError) loginError.textContent = error.message || "로그인에 실패했습니다.";
  } finally {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
});

loadAuthProviders();
