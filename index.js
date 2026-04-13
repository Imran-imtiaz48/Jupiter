const path = require("path");
const { rollup } = require("rollup");
const fs = require("fs").promises;
const { builtinModules } = require("module");

const commonjs = require("@rollup/plugin-commonjs");
const alias = require("@rollup/plugin-alias");
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const swc = require("rollup-plugin-swc").default;

// -----------------------------
// Resolve plugin path
// -----------------------------
const pluginArg = process.argv.slice(2).find(arg => arg !== "--");

if (!pluginArg) {
    console.error("Plugin path not provided.");
    process.exit(1);
}

const pluginPath = path.resolve(pluginArg);
const manifestPath = path.join(pluginPath, "manifest.json");
const manifest = require(manifestPath);

// Output file
const distFile = path.resolve(
    process.cwd(),
    "dist",
    `${manifest.name.replace(/\s+/g, "")}.plugin.js`
);

// -----------------------------
// Generate metadata banner
// -----------------------------
function generateMeta(manifestData) {
    const lines = Object.entries(manifestData)
        .map(([key, value]) => ` * @${key} ${value}`)
        .join("\n");

    return `/**\n${lines}\n */\n\n`;
}

// -----------------------------
// Build function
// -----------------------------
async function build() {
    console.time("Build completed in");

    try {
        const bundle = await rollup({
            input: path.join(pluginPath, "index.js"),
            external: builtinModules,
            plugins: [
                commonjs(),

                alias({
                    entries: [
                        {
                            find: /^powercord/i,
                            replacement: path.resolve(__dirname, "powercord")
                        }
                    ],
                    customResolver: nodeResolve({
                        extensions: [".js", ".ts", ".jsx", ".tsx"]
                    })
                }),

                swc({
                    jsc: {
                        target: "es2022"
                    }
                })
            ]
        });

        const { output } = await bundle.generate({
            format: "cjs",
            exports: "auto"
        });

        let code = output[0].code;

        const metadata = generateMeta(manifest);
        const manifestConst = `const manifest = Object.freeze(${JSON.stringify(manifest, null, 4)});\n\n`;

        const finalCode = metadata + manifestConst + code;

        await fs.writeFile(distFile, finalCode);

        console.timeEnd("Build completed in");
        console.log(`Plugin built successfully: ${distFile}`);

    } catch (error) {
        console.error("Build failed:");
        console.error(error);
        process.exit(1);
    }
}

build();
