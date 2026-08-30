#!/usr/bin/env python3
"""Adversarial Firebase Storage emulator tests for the avatar contract."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

AUTH_BASE = "http://127.0.0.1:9099"
STORAGE_BASE = "http://127.0.0.1:9199"
BUCKET = "demo-mira.appspot.com"


def request(
    method: str,
    url: str,
    *,
    body: bytes | None = None,
    token: str | None = None,
    content_type: str = "application/json",
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    headers = {"Content-Type": content_type}
    headers.update(extra_headers or {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, data=body, headers=headers, method=method)
        ) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def sign_up(label: str) -> tuple[str, str]:
    payload = json.dumps(
        {
            "email": f"{label}@example.test",
            "password": "emulator-only-password",
            "returnSecureToken": True,
        }
    ).encode()
    status, raw = request(
        "POST",
        f"{AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
        body=payload,
    )
    assert status == 200, (status, raw.decode(errors="replace"))
    data = json.loads(raw)
    return data["localId"], data["idToken"]


def upload(
    path: str,
    payload: bytes,
    *,
    token: str | None,
    content_type: str,
) -> int:
    name = urllib.parse.quote(path, safe="")
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(len(payload)),
        "X-Goog-Upload-Header-Content-Type": content_type,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(
                f"{STORAGE_BASE}/v0/b/{BUCKET}/o?name={name}",
                data=json.dumps(
                    {"name": path, "contentType": content_type}
                ).encode(),
                headers=headers,
                method="POST",
            )
        ) as start_response:
            upload_url = start_response.headers.get("X-Goog-Upload-URL")
            assert upload_url, "storage emulator omitted resumable upload URL"

        upload_headers = {
            "Content-Type": "application/octet-stream",
            "X-Goog-Upload-Command": "upload, finalize",
            "X-Goog-Upload-Offset": "0",
        }
        if token:
            upload_headers["Authorization"] = f"Bearer {token}"
        with urllib.request.urlopen(
            urllib.request.Request(
                upload_url,
                data=payload,
                headers=upload_headers,
                method="POST",
            )
        ) as response:
            status = response.status
            raw = response.read()
    except urllib.error.HTTPError as error:
        status = error.code
        raw = error.read()

    if status not in (200, 201):
        print(
            f"upload {path} returned {status}: "
            f"{raw.decode(errors='replace')[:300]}"
        )
    return status


def download(path: str, token: str | None) -> int:
    name = urllib.parse.quote(path, safe="")
    status, _ = request(
        "GET",
        f"{STORAGE_BASE}/v0/b/{BUCKET}/o/{name}?alt=media",
        token=token,
    )
    return status


def assert_denied(status: int) -> None:
    assert status in (401, 403), f"expected denial, got HTTP {status}"


def main() -> None:
    owner_uid, owner_token = sign_up("owner")
    _, other_token = sign_up("other")
    canonical = f"avatars/{owner_uid}/avatar"
    valid_jpeg = b"\xff\xd8\xff\xe0emulator-avatar"

    owner_status = upload(
        canonical,
        valid_jpeg,
        token=owner_token,
        content_type="image/jpeg",
    )
    assert owner_status == 200, f"owner upload returned HTTP {owner_status}"
    assert download(canonical, other_token) == 200
    assert_denied(download(canonical, None))

    assert_denied(
        upload(
            canonical,
            valid_jpeg,
            token=other_token,
            content_type="image/jpeg",
        )
    )
    assert_denied(
        upload(canonical, valid_jpeg, token=None, content_type="image/jpeg")
    )
    assert_denied(
        upload(
            f"avatars/{owner_uid}.jpg",
            valid_jpeg,
            token=owner_token,
            content_type="image/jpeg",
        )
    )
    assert_denied(
        upload(
            canonical,
            b"not-an-image",
            token=owner_token,
            content_type="application/pdf",
        )
    )
    assert_denied(
        upload(
            canonical,
            b"x" * (5 * 1024 * 1024 + 1),
            token=owner_token,
            content_type="image/png",
        )
    )

    print("firebase-avatar-storage-rules: PASS (7 adversarial cases)")


if __name__ == "__main__":
    main()
