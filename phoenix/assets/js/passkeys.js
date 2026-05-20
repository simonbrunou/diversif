// Minimal WebAuthn browser glue. Mirrors what @simplewebauthn/browser does
// internally (base64url encode/decode + navigator.credentials.create/get) but
// avoids pulling the npm dep — Phoenix esbuild has no package.json by default.

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

// Hook for "register a new passkey" button. Triggers on click.
export const PasskeyRegister = {
  mounted() {
    this.el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!window.PublicKeyCredential) {
        alert("Votre navigateur ne prend pas en charge les clés d'accès.");
        return;
      }
      const name = this.el.dataset.name || prompt("Nom de cette clé ?") || "Passkey";
      this.el.disabled = true;
      try {
        const opts = await postJson("/api/webauthn/registration/options", {});
        const cred = await navigator.credentials.create({
          publicKey: decodePublicKeyOptions(opts),
        });
        await postJson("/api/webauthn/registration/verify", {
          name,
          response: encodeAttestation(cred),
        });
        window.location.reload();
      } catch (err) {
        alert(`Échec de l'enregistrement : ${err.message || err}`);
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
        alert("Votre navigateur ne prend pas en charge les clés d'accès.");
        return;
      }
      this.el.disabled = true;
      try {
        const opts = await postJson("/api/webauthn/authentication/options", {});
        const cred = await navigator.credentials.get({
          publicKey: decodePublicKeyOptions(opts),
        });
        // The verify endpoint sets the session cookie and (on success) issues
        // a 302 redirect via UserAuth.log_in_user. fetch follows redirects
        // automatically; we land on the home page.
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
        alert(`Connexion impossible : ${err.message || err}`);
      } finally {
        this.el.disabled = false;
      }
    });
  },
};
