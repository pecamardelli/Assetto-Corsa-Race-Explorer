const fs = require("fs");
const path = require("path");
const http = require("http");

// Configuration
const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;
const OUTPUT_DIR = path.join(__dirname, "..", "public", "driver-portraits");
const CHAMPIONSHIP_DATA_DIR = path.join(
  __dirname,
  "..",
  "app",
  "data",
  "championship"
);
const PROMPTS_FILE = path.join(__dirname, "assetto_corsa_drivers_prompts.json");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Get all unique driver names from race data files
 */
function getAllDrivers() {
  const drivers = new Set();

  function processDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        processDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
          if (data.driver_statistics) {
            Object.keys(data.driver_statistics).forEach((driver) =>
              drivers.add(driver)
            );
          }
        } catch (err) {
          console.error(`Error reading ${fullPath}:`, err.message);
        }
      }
    }
  }

  processDirectory(CHAMPIONSHIP_DATA_DIR);
  return Array.from(drivers).sort();
}

/**
 * Queue a prompt in ComfyUI
 */
function queuePrompt(workflow) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ prompt: workflow });

    const options = {
      hostname: COMFYUI_HOST,
      port: COMFYUI_PORT,
      path: "/prompt",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * Get workflow status
 */
function getHistory(promptId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: COMFYUI_HOST,
      port: COMFYUI_PORT,
      path: `/history/${promptId}`,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Download generated image
 */
function downloadImage(filename, subfolder, type) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ filename, subfolder, type });

    const options = {
      hostname: COMFYUI_HOST,
      port: COMFYUI_PORT,
      path: `/view?${params.toString()}`,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Wait for workflow to complete
 */
async function waitForCompletion(promptId, timeout = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      const history = await getHistory(promptId);

      if (history[promptId]) {
        const status = history[promptId].status;

        if (status && status.completed) {
          return history[promptId];
        }

        if (status && status.status_str === "error") {
          throw new Error("Workflow execution failed");
        }
      }
    } catch (err) {
      // History might not be available yet, continue waiting
    }
  }

  throw new Error("Timeout waiting for workflow completion");
}

/**
 * Load driver prompts data
 */
function loadDriverPrompts() {
  if (!fs.existsSync(PROMPTS_FILE)) {
    console.error("\n⚠️  Driver prompts file not found!");
    console.error(`Expected location: ${PROMPTS_FILE}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
}

/**
 * Load and modify workflow for a specific driver
 */
function loadWorkflow(driverName, driverPrompts) {
  // Read the workflow JSON from ComfyUI
  const workflowPath = path.join(__dirname, "comfyui-workflow.json");

  if (!fs.existsSync(workflowPath)) {
    console.error("\n⚠️  Workflow file not found!");
    console.error(
      "Please export your ComfyUI workflow as JSON and save it to:"
    );
    console.error(`   ${workflowPath}`);
    console.error(
      "\nIn ComfyUI: Settings → Save (API Format) → comfyui-workflow.json\n"
    );
    process.exit(1);
  }

  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
  const promptData = driverPrompts[driverName];

  if (!promptData) {
    console.warn(`  ⚠️  No prompt data found for ${driverName}, using default`);
  }

  // Build prompts from features
  const features = promptData?.features || "athletic build, confident features";
  const age = promptData?.age || 30;
  const nationality = promptData?.nationality || "American";
  const gender = promptData?.gender || "male";

  // Randomize facial expression and gesture for each generation
  const expressions = [
    { expression: "neutral confident expression", negatives: "smile, grin, showing teeth, laughing, happy" },
    { expression: "subtle slight smile, friendly expression", negatives: "wide smile, big grin, showing teeth, laughing, exaggerated happy" },
    { expression: "serious intense expression, focused look", negatives: "smile, grin, happy, relaxed, cheerful" },
    { expression: "calm composed expression", negatives: "smile, grin, excited, emotional, laughing" },
    { expression: "slight smirk, confident look", negatives: "full smile, grin, showing teeth, laughing, wide smile" },
    { expression: "determined focused expression", negatives: "smile, grin, relaxed, casual, happy" },
    { expression: "stoic professional expression", negatives: "smile, grin, emotional, expressive, laughing" },
    { expression: "subtle smile, approachable look", negatives: "wide smile, big grin, showing teeth, laughing" }
  ];

  // Randomize body position/angle
  const positions = [
    "facing camera directly, front view",
    "body turned at 45 degree angle, head turned looking at camera",
    "slight 45 degree angle, shoulders turned, looking directly at camera",
    "three-quarter view, body angled, face toward camera"
  ];

  // Randomize racing suit colors and styles
  const racingSuits = [
    "wearing red racing suit with white stripes",
    "wearing blue racing suit with sponsor logos",
    "wearing black racing suit with red accents",
    "wearing white racing suit with blue details",
    "wearing green racing suit",
    "wearing yellow and black racing suit",
    "wearing navy blue racing suit with white stripes",
    "wearing orange racing suit",
    "wearing grey racing suit with black details",
    "wearing red and white racing suit",
    "wearing black and yellow racing suit",
    "wearing blue and white racing suit"
  ];

  const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];
  const randomPosition = positions[Math.floor(Math.random() * positions.length)];
  const randomSuit = racingSuits[Math.floor(Math.random() * racingSuits.length)];

  const positivePrompt = `realistic professional studio portrait photograph, ${nationality} racing driver, ${age} years old, ${gender}, ${features}, ${randomSuit}, ${randomPosition}, upper body portrait showing torso and shoulders, ${randomExpression.expression}, looking directly at camera, natural skin texture with pores and details, professional studio lighting, plain grey background, sharp focus on face, photorealistic, high detail, professional racing portrait`;

  const negativePrompt = `${randomExpression.negatives}, exaggerated expression, fashion model pose, heavy makeup, racing helmet, hat, cap, sunglasses, goggles, glasses, extreme close-up, cropped face, cut off torso, out of frame, plastic skin, smooth skin, CGI, 3D render, illustration, drawing, painting, cartoon, anime, celebrity lookalike, famous person, multiple people, text, watermark, low quality, blurry`;

  // Find positive and negative prompt nodes
  let positivePromptNode = null;
  let negativePromptNode = null;

  // First pass: identify nodes by their content or title
  for (const [nodeId, node] of Object.entries(workflow)) {
    if (
      node.class_type === "CLIPTextEncode" &&
      node.inputs &&
      node.inputs.text !== undefined
    ) {
      const currentText = String(node.inputs.text).toLowerCase();
      const title = String(node._meta?.title || "").toLowerCase();

      // Heuristics to identify negative prompt
      if (
        currentText.includes("negative") ||
        currentText.includes("bad quality") ||
        currentText.includes("low quality") ||
        currentText.includes("worst quality") ||
        title.includes("negative")
      ) {
        negativePromptNode = nodeId;
      } else if (!positivePromptNode) {
        // First non-negative CLIPTextEncode is likely the positive prompt
        positivePromptNode = nodeId;
      }
    }
  }

  // If we couldn't identify nodes, use first two CLIPTextEncode nodes
  if (!positivePromptNode || !negativePromptNode) {
    const clipNodes = Object.entries(workflow)
      .filter(([, node]) => node.class_type === "CLIPTextEncode")
      .map(([id]) => id);

    if (clipNodes.length >= 2) {
      positivePromptNode = positivePromptNode || clipNodes[0];
      negativePromptNode = negativePromptNode || clipNodes[1];
    }
  }

  // Update the prompts
  if (positivePromptNode && workflow[positivePromptNode]) {
    workflow[positivePromptNode].inputs.text = positivePrompt;
  }

  if (negativePromptNode && workflow[negativePromptNode]) {
    workflow[negativePromptNode].inputs.text = negativePrompt;
  }

  // Update seed for variation in all KSampler nodes
  for (const [, node] of Object.entries(workflow)) {
    if (
      node.class_type === "KSampler" &&
      node.inputs &&
      node.inputs.seed !== undefined
    ) {
      node.inputs.seed = Math.floor(Math.random() * 1000000000);
    }
  }

  return { workflow, expression: randomExpression.expression, position: randomPosition, suit: randomSuit };
}

/**
 * Generate portrait for a single driver
 */
async function generateDriverPortrait(driverName, index, total, driverPrompts) {
  const promptData = driverPrompts[driverName];
  const nationality = promptData?.nationality || "Unknown";
  const age = promptData?.age || "N/A";

  console.log(`\n[${index}/${total}] Generating portrait for: ${driverName}`);
  console.log(`  📍 ${nationality} | Age: ${age}`);

  // Check if portrait already exists
  const outputPath = path.join(
    OUTPUT_DIR,
    `${driverName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`
  );
  if (fs.existsSync(outputPath)) {
    console.log(`  ✓ Portrait already exists, skipping...`);
    return;
  }

  try {
    // Load and customize workflow
    const { workflow, expression, position, suit } = loadWorkflow(driverName, driverPrompts);
    console.log(`  😊 Expression: ${expression}`);
    console.log(`  📐 Position: ${position}`);
    console.log(`  👔 Suit: ${suit}`);

    // Queue the prompt
    console.log("  → Queuing workflow...");
    const result = await queuePrompt(workflow);
    const promptId = result.prompt_id;
    console.log(`  → Prompt ID: ${promptId}`);

    // Wait for completion
    console.log("  → Waiting for generation...");
    const history = await waitForCompletion(promptId);

    // Find the output image
    const outputs = history.outputs;
    let imageData = null;

    for (const [, output] of Object.entries(outputs)) {
      if (output.images && output.images.length > 0) {
        const image = output.images[0];
        console.log("  → Downloading image...");
        imageData = await downloadImage(
          image.filename,
          image.subfolder,
          image.type
        );
        break;
      }
    }

    if (!imageData) {
      throw new Error("No output image found");
    }

    // Save the image
    fs.writeFileSync(outputPath, imageData);
    console.log(`  ✓ Saved to: ${outputPath}`);
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
    throw err;
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🎨 ComfyUI Driver Portrait Generator\n");
  console.log("=".repeat(60));

  // Load driver prompts
  console.log("\n📄 Loading driver prompts...");
  const driverPrompts = loadDriverPrompts();
  console.log(
    `   Loaded prompts for ${Object.keys(driverPrompts).length} drivers`
  );

  // Get all drivers from race data
  console.log("\n📋 Scanning race data for drivers...");
  const drivers = getAllDrivers();
  console.log(`   Found ${drivers.length} unique drivers\n`);

  // Check which drivers have prompts
  const driversWithPrompts = drivers.filter((d) => driverPrompts[d]);
  const driversWithoutPrompts = drivers.filter((d) => !driverPrompts[d]);

  console.log(`   ✓ ${driversWithPrompts.length} drivers have custom prompts`);
  if (driversWithoutPrompts.length > 0) {
    console.log(
      `   ⚠️  ${driversWithoutPrompts.length} drivers missing prompts (will use default):`
    );
    driversWithoutPrompts.forEach((d) => console.log(`      - ${d}`));
  }

  // List drivers to process
  console.log("\nDrivers to process:");
  drivers.forEach((driver, i) => {
    const hasPrompt = driverPrompts[driver] ? "✓" : "⚠️";
    const nationality = driverPrompts[driver]?.nationality || "?";
    console.log(
      `  ${hasPrompt} ${(i + 1).toString().padStart(3)}. ${driver.padEnd(
        25
      )} (${nationality})`
    );
  });

  console.log("\n" + "=".repeat(60));
  console.log("\n🚀 Starting generation process...\n");

  let successful = 0;
  let failed = 0;
  const failedDrivers = [];

  for (let i = 0; i < drivers.length; i++) {
    try {
      await generateDriverPortrait(
        drivers[i],
        i + 1,
        drivers.length,
        driverPrompts
      );
      successful++;

      // Small delay between generations
      if (i < drivers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      failed++;
      failedDrivers.push(drivers[i]);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Generation Summary:\n");
  console.log(`  ✓ Successful: ${successful}`);
  console.log(`  ✗ Failed: ${failed}`);

  if (failedDrivers.length > 0) {
    console.log("\n  Failed drivers:");
    failedDrivers.forEach((driver) => console.log(`    - ${driver}`));
  }

  console.log(`\n  📁 Output directory: ${OUTPUT_DIR}`);
  console.log("\n" + "=".repeat(60) + "\n");
}

// Run the script
if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { getAllDrivers, generateDriverPortrait };
