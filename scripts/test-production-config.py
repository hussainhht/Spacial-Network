#!/usr/bin/env python3
"""Regression probes for the production failures and exposure invariants."""
import copy
import json
import sys
import unittest
from check_production_config import check


class ProductionConfigTests(unittest.TestCase):
    def test_current_config(self):
        check(self.config)

    def test_reject_regressions(self):
        mutations = {
            "split tmpfs": lambda c: c["services"]["backend"].update(
                tmpfs=["/tmp:rw", "noexec", "nosuid", "size=64m", "mode=1777"]),
            "missing noexec": lambda c: c["services"]["proxy"].update(
                tmpfs=["/tmp:rw,nosuid,size=64m,mode=1777"]),
            "public proxy": lambda c: c["services"]["proxy"]["ports"][0].update(host_ip="0.0.0.0"),
            "published backend": lambda c: c["services"]["backend"].update(ports=[{"target": 8080}]),
            "internal frontend": lambda c: c["networks"]["frontend"].update(internal=True),
            "public backend": lambda c: c["networks"]["backend"].update(internal=False),
            "lost data volume": lambda c: c["services"]["backend"]["volumes"].clear(),
            "browser localhost": lambda c: c["services"]["frontend"]["build"]["args"].update(
                NEXT_PUBLIC_BACKEND_ORIGIN="http://localhost:8080"),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                broken = copy.deepcopy(self.config)
                mutate(broken)
                with self.assertRaises((AssertionError, KeyError)):
                    check(broken)


if __name__ == "__main__":
    ProductionConfigTests.config = json.load(open(sys.argv.pop(1)))
    unittest.main()
