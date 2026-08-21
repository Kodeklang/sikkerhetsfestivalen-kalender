// The map templates look photos up in. Generation itself happens in
// eleventy.before (see eleventy.config.mjs), because the passthrough copy that
// publishes these files runs before the data cascade - if the images were first
// written here, they would be copied on the *next* build, not this one. By the
// time this runs every derivative is already on disk, so it only reads paths.

import { buildAvatars } from "../../lib/avatars.mjs";

export default buildAvatars;
