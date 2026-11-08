#!/usr/bin/env python3
"""Check normalized `docker compose config --format json` without dependencies."""
import json
import sys
from urllib.parse import urlparse


def check(config):
    services = config["services"]
    assert set(services) == {"proxy", "frontend", "backend"}, "unexpected services"
    for name, service in services.items():
        assert not service.get("privileged"), f"{name}: privileged"
        assert not service.get("network_mode"), f"{name}: network_mode bypasses isolation"
        assert service.get("read_only"), f"{name}: writable root"
        assert "ALL" in service.get("cap_drop", []), f"{name}: capabilities not dropped"
        assert "no-new-privileges:true" in service.get("security_opt", []), name
        mounts = service.get("tmpfs", [])
        assert mounts, f"{name}: missing tmpfs"
        for mount in mounts:
            path, sep, options = mount.partition(":")
            assert path.startswith("/") and sep, f"{name}: malformed tmpfs {mount!r}"
            flags = set(options.split(","))
            assert {"rw", "nosuid"} <= flags, f"{name}: insecure tmpfs {mount}"
            assert any(flag.startswith("size=") for flag in flags), f"{name}: unbounded tmpfs"
            if path == "/tmp":
                assert {"noexec", "size=64m", "mode=1777"} <= flags, name
        assert any(m.startswith("/tmp:") for m in mounts), name
        if name != "proxy":
            assert not service.get("ports"), f"{name}: host ports published"

    ports = services["proxy"].get("ports", [])
    assert len(ports) == 1, "proxy must publish exactly one port"
    port = ports[0]
    assert (port.get("host_ip"), str(port["published"]), port["target"],
            port.get("protocol", "tcp")) == ("127.0.0.1", "8088", 8080, "tcp"), ports
    assert not config["networks"]["frontend"].get("internal", False), "frontend bridge is internal"
    assert config["networks"]["backend"].get("internal") is True, "backend bridge is public"
    for name, expected in (("proxy", {"frontend", "backend"}),
                           ("frontend", {"frontend"}), ("backend", {"backend"})):
        assert set(services[name]["networks"]) == expected, f"{name}: network membership"

    volumes = {v["target"]: v for v in services["backend"]["volumes"]}
    for target, source in (("/app/data", "backend-data"), ("/app/data/uploads", "uploads")):
        mount = volumes[target]
        assert mount["type"] == "volume" and mount["source"] == source, mount
        assert not mount.get("read_only"), mount
        assert source in config["volumes"], f"missing named volume {source}"

    args = services["frontend"]["build"]["args"]
    for key in ("NEXT_PUBLIC_BACKEND_ORIGIN", "NEXT_PUBLIC_BACKEND_WS_ORIGIN"):
        assert args.get(key) == "", f"{key} must be empty for same-origin production"
        assert services["frontend"].get("environment", {}).get(key, "") == "", key
    assert args.get("NEXT_IMAGE_UNOPTIMIZED") == "true", "image optimization must stay disabled"
    origin = services["backend"]["environment"]["TRUSTED_ORIGINS"]
    parsed = urlparse(origin)
    assert parsed.scheme == "https" and parsed.hostname == "social.l3acler.com", origin
    assert parsed.netloc == "social.l3acler.com" and not (parsed.path or parsed.query or parsed.fragment), origin
    assert args["SITE_URL"] == origin, "frontend/backend origin mismatch"
    for key in ("COOKIE_SECURE", "TRUST_PROXY"):
        assert services["backend"]["environment"][key] == "true", key
    assert services["backend"]["environment"]["APP_ENV"] == "production"


if __name__ == "__main__":
    try:
        check(json.load(sys.stdin))
    except (AssertionError, KeyError, TypeError, ValueError) as error:
        sys.exit(f"Production configuration failed: {error}")
    print("Production configuration passed: tmpfs, loopback ports, networks, security, volumes, origins")
