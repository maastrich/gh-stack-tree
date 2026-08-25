# Security

The extension stores your GitHub token in `browser.storage.sync` and only sends
it to `https://api.github.com` from the background service worker. Content
scripts never see it.

Found a vulnerability? Please do not open a public issue. Use GitHub's private
vulnerability reporting on this repository, or email the maintainer.
