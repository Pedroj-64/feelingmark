// Firma release con el keystore indicado por variables de entorno (CI o ~/claves);
// sin ellas, cae a la clave debug para que `expo prebuild` siga funcionando.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes("FEELINGMARK_KEYSTORE")) return c;
    c.modResults.contents = c.modResults.contents
      .replace(
        "    signingConfigs {",
        `    signingConfigs {
        release {
            if (System.getenv("FEELINGMARK_KEYSTORE")) {
                storeFile file(System.getenv("FEELINGMARK_KEYSTORE"))
                storePassword System.getenv("FEELINGMARK_STORE_PASSWORD")
                keyAlias System.getenv("FEELINGMARK_KEY_ALIAS") ?: "upload"
                keyPassword System.getenv("FEELINGMARK_KEY_PASSWORD")
            }
        }`,
      )
      .replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        `$1signingConfig System.getenv("FEELINGMARK_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`,
      );
    return c;
  });
