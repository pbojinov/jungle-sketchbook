const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'android-tv');
const manifest = fs.readFileSync(
  path.join(root, 'app', 'src', 'main', 'AndroidManifest.xml'),
  'utf8',
);
const activity = fs.readFileSync(
  path.join(root, 'app', 'src', 'main', 'java', 'com', 'junglesketchbook', 'tv',
    'MainActivity.kt'),
  'utf8',
);
const networkSecurity = fs.readFileSync(
  path.join(root, 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml'),
  'utf8',
);
const policy = fs.readFileSync(
  path.join(root, 'app', 'src', 'main', 'java', 'com', 'junglesketchbook', 'tv',
    'UrlPolicy.kt'),
  'utf8',
);

assert.match(manifest, /android\.software\.leanback/);
assert.match(manifest, /android\.hardware\.touchscreen" android:required="false"/);
assert.match(manifest, /android:networkSecurityConfig=/);
assert.doesNotMatch(manifest, /android:usesCleartextTraffic="true"/);
assert.match(networkSecurity, /base-config cleartextTrafficPermitted="false"/);
assert.match(networkSecurity, /<domain>sketchbook\.local<\/domain>/);
assert.match(activity, /FLAG_KEEP_SCREEN_ON/);
assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
assert.match(activity, /allowFileAccess = false/);
assert.match(activity, /UrlPolicy\.allowsNavigation/);
assert.match(activity, /UrlPolicy\.allowsResource/);
assert.match(policy, /isPrivateHost/);
assert.match(policy, /sameOrigin/);

console.log('Android TV contract checks passed');
