#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2024 Test Project

"""Simple greeting script"""

def greet(name):
    return f"Hello, {name}!"

def main():
    names = ["Alice", "Bob", "Charlie"]
    for name in names:
        print(greet(name))

if __name__ == "__main__":
    main()
