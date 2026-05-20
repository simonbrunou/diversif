// Minimal WebAuthn glue. The server emits / accepts JSON in the same shape
// that @simplewebauthn/browser uses (base64url for binary fields), so we
// can roll our own bridge in ~120 lines instead of pulling that dep. Phoenix
// 1.8 *can* consume npm packages, but every dep we add to assets/package.json
// is one more thing to keep patched.

const b64urlEncode = (buf) => {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (str) => {
  const pad = str.length % 4 ? str + "=".repeat(4 - (str.length % 4)) : str;
  const bin = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const csrfHeader = () => {
  const token = document.querySelector("meta[name='csrf-token']")?.getAttribute("content");
  return token ? { "x-csrf-token": token } : {};
};

const postJson = async (path, body) => {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...csrfHeader() },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
};

const decodePublicKeyOptions = (opts) => ({
  ...opts,
  challenge: b64urlDecode(opts.challenge),
  user: opts.user && { ...opts.user, id: b64urlDecode(opts.user.id) },
  excludeCredentials: (opts.excludeCredentials || []).map((c) => ({
    ...c, id: b64urlDecode(c.id),
  })),
  allowCredentials: (opts.allowCredentials || []).map((c) => ({
    ...c, id: b64urlDecode(c.id),
  })),
});

const encodeAttestation = (cred) => ({
  id: cred.id,
  rawId: b64urlEncode(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: b64urlEncode(cred.response.clientDataJSON),
    attestationObject: b64urlEncode(cred.response.attestationObject),
    transports: cred.response.getTransports?.() ?? [],
  },
});

const encodeAssertion = (cred) => ({
  id: cred.id,
  rawId: b64urlEncode(cred.rawId),
  type: cred.type,
  response: {
    clientDataJSON: b64urlEncode(cred.response.clientDataJSON),
    authenticatorData: b64urlEncode(cred.response.authenticatorData),
    signature: b64urlEncode(cred.response.signature),
    userHandle: cred.response.userHandle && b64urlEncode(cred.response.userHandle),
  },
});

// NotAllowedError + AbortError are what the browser throws when the user
// cancels the OS prompt or the prompt times out. They're not errors that
// deserve a scary "Échec" alert.
const isUserCancellation = (err) =>
  err && (err.name === "NotAllowedError" || err.name === "AbortError");

// Hook for "register a new passkey" button. Reads the name from a sibling
// input identified by data-name-input (CSS selector) or falls back to a
// generic label.
export const PasskeyRegister = {
  mounted() {
    this.el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!window.PublicKeyCredential) {
        this.pushEvent("passkey:unsupported", {});
        return;
      }

      const selector = this.el.dataset.nameInput;
      const nameField = selector ? document.querySelector(selector) : null;
      const name = (nameField?.value || "Passkey").trim().slice(0, 80);

      this.el.disabled = true;
      try {
        const opts = await postJson("/api/webauthn/registration/options", {});
        const cred = await navigator.credentials.create({
          publicKey: decodePublicKeyOptions(opts),
        });
        const result = await postJson("/api/webauthn/registration/verify", {
          name,
          response: encodeAttestation(cred),
        });
        if (nameField) nameField.value = "";
        // Push the new passkey row up so the LiveView can prepend it without
        // hard-reloading and dropping our socket.
        this.pushEvent("passkey:added", { passkey: result.passkey });
      } catch (err) {
        if (isUserCancellation(err)) return;
        this.pushEvent("passkey:error", { error: err.message || String(err) });
      } finally {
        this.el.disabled = false;
      }
    });
  },
};

// Hook for "sign in with a passkey" button on the login screen.
export const PasskeyAuthenticate = {
  mounted() {
    this.el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!window.PublicKeyCredential) {
        this.pushEvent("passkey:unsupported", {});
        return;
      }
      this.el.disabled = true;
      try {
        const opts = await postJson("/api/webauthn/authentication/options", {});
        const cred = await navigator.credentials.get({
          publicKey: decodePublicKeyOptions(opts),
        });
        // verify sets the session cookie + returns 302 via UserAuth.log_in_user.
        // fetch follows redirects; land on the home page (or wherever the
        // server told us).
        const res = await fetch("/api/webauthn/authentication/verify", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", ...csrfHeader() },
          body: JSON.stringify({ response: encodeAssertion(cred) }),
        });
        if (res.redirected) {
          window.location.href = res.url;
        } else if (res.ok) {
          window.location.href = "/";
        } else {
          const err = await res.json().catch(() => ({ error: "Échec" }));
          throw new Error(err.error);
        }
      } catch (err) {
        if (isUserCancellation(err)) return;
        this.pushEvent("passkey:error", { error: err.message || String(err) });
      } finally {
        this.el.disabled = false;
      }
    });
  },
};
