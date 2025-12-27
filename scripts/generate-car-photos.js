const fs = require("fs");
const path = require("path");
const http = require("http");

// Configuration
const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;
const OUTPUT_DIR = path.join(__dirname, "..", "public", "car-gallery");
const CAR_LIST_FILE = path.join(__dirname, "..", "car-list.json");
const PHOTOS_PER_CAR = 3;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
 * Load car list
 */
function loadCarList() {
  if (!fs.existsSync(CAR_LIST_FILE)) {
    console.error("\n⚠️  Car list file not found!");
    console.error(`Expected location: ${CAR_LIST_FILE}`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(CAR_LIST_FILE, "utf8"));
}

/**
 * Get car category/era for better prompts
 */
function getCarCategory(year) {
  if (year < 1950) return "vintage classic";
  if (year < 1970) return "classic";
  if (year < 1980) return "retro";
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  return "modern";
}

/**
 * Load and modify workflow for a specific car and angle
 */
function loadWorkflow(carData, angleIndex) {
  const workflowPath = path.join(__dirname, "comfyui-workflow.json");

  if (!fs.existsSync(workflowPath)) {
    console.error("\n⚠️  Workflow file not found!");
    console.error(`Expected location: ${workflowPath}`);
    process.exit(1);
  }

  const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

  // Define different angles/views for variety
  const angles = [
    {
      view: "three-quarter front view",
      angle: "35 degree angle",
      lighting: "studio lighting with soft shadows",
      background: "gradient grey studio background"
    },
    {
      view: "side profile view",
      angle: "90 degree side angle",
      lighting: "dramatic side lighting highlighting curves",
      background: "dark gradient background"
    },
    {
      view: "front three-quarter view",
      angle: "45 degree front angle",
      lighting: "bright studio lighting",
      background: "white seamless studio background"
    }
  ];

  const selectedAngle = angles[angleIndex % angles.length];
  const category = getCarCategory(carData.year || 1980);

  // Build the positive prompt
  const carDescription = `${carData.name}`;
  const yearInfo = carData.year ? `from ${carData.year}` : "";

  const positivePrompt = `professional automotive photography, ${carDescription} ${yearInfo}, ${category} sports car, ${selectedAngle.view}, ${selectedAngle.angle}, ${selectedAngle.lighting}, ${selectedAngle.background}, highly detailed, sharp focus, 8k resolution, photorealistic, professional car photography, perfect reflections on paint, detailed wheels and tires, automotive magazine quality, clean and pristine condition, realistic materials and textures`;

  const negativePrompt = `low quality, blurry, out of focus, amateur photo, watermark, text, logo, person, people, driver, indoor showroom, motion blur, distorted perspective, cartoonish, CGI render look, oversaturated, noise, grain, dirty car, damaged car, unrealistic proportions, toy car, miniature, bad lighting, underexposed, overexposed`;

  // Find positive and negative prompt nodes
  let positivePromptNode = null;
  let negativePromptNode = null;

  for (const [nodeId, node] of Object.entries(workflow)) {
    if (
      node.class_type === "CLIPTextEncode" &&
      node.inputs &&
      node.inputs.text !== undefined
    ) {
      const currentText = String(node.inputs.text).toLowerCase();
      const title = String(node._meta?.title || "").toLowerCase();

      if (
        currentText.includes("negative") ||
        currentText.includes("bad quality") ||
        currentText.includes("low quality") ||
        title.includes("negative")
      ) {
        negativePromptNode = nodeId;
      } else if (!positivePromptNode) {
        positivePromptNode = nodeId;
      }
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

  // Update image dimensions for landscape car photos (16:9 ratio works well for cars)
  for (const [, node] of Object.entries(workflow)) {
    if (
      node.class_type === "EmptyLatentImage" &&
      node.inputs &&
      node.inputs.width !== undefined
    ) {
      node.inputs.width = 1024;  // Higher resolution for detail
      node.inputs.height = 768;  // 4:3 ratio, good for car photography
    }
  }

  return { workflow, view: selectedAngle.view };
}

/**
 * Generate photo for a single car at a specific angle
 */
async function generateCarPhoto(carData, angleIndex, photoNum, totalPhotos) {
  console.log(`  [${photoNum}/${totalPhotos}] Generating angle ${angleIndex + 1}...`);

  // Create car-specific directory
  const carDir = path.join(OUTPUT_DIR, carData.id);
  if (!fs.existsSync(carDir)) {
    fs.mkdirSync(carDir, { recursive: true });
  }

  // Check if photo already exists (two-digit naming: 01.png, 02.png, 03.png)
  const photoNum = String(angleIndex + 1).padStart(2, '0');
  const outputPath = path.join(carDir, `${photoNum}.png`);
  if (fs.existsSync(outputPath)) {
    console.log(`    ✓ Photo already exists, skipping...`);
    return;
  }

  try {
    // Load and customize workflow
    const { workflow, view } = loadWorkflow(carData, angleIndex);
    console.log(`    📷 View: ${view}`);

    // Queue the prompt
    console.log("    → Queuing workflow...");
    const result = await queuePrompt(workflow);
    const promptId = result.prompt_id;
    console.log(`    → Prompt ID: ${promptId}`);

    // Wait for completion
    console.log("    → Waiting for generation...");
    const history = await waitForCompletion(promptId);

    // Find the output image
    const outputs = history.outputs;
    let imageData = null;

    for (const [, output] of Object.entries(outputs)) {
      if (output.images && output.images.length > 0) {
        const image = output.images[0];
        console.log("    → Downloading image...");
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
    console.log(`    ✓ Saved to: ${outputPath}`);
  } catch (err) {
    console.error(`    ✗ Error: ${err.message}`);
    throw err;
  }
}

/**
 * Generate all photos for a single car
 */
async function generateCarPhotos(carData, index, total) {
  console.log(`\n[${index}/${total}] ${carData.name}`);
  console.log(`  🏭 ${carData.brand} | Year: ${carData.year || "N/A"}`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < PHOTOS_PER_CAR; i++) {
    try {
      await generateCarPhoto(carData, i, i + 1, PHOTOS_PER_CAR);
      successful++;

      // Small delay between generations
      if (i < PHOTOS_PER_CAR - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      failed++;
    }
  }

  return { successful, failed };
}

/**
 * Main function
 */
async function main() {
  console.log("🚗 ComfyUI Car Photo Gallery Generator\n");
  console.log("=".repeat(60));

  // Load car list
  console.log("\n📄 Loading car list...");
  const cars = loadCarList();
  console.log(`   Loaded ${cars.length} cars`);

  // Display car list
  console.log("\nCars to process:");
  cars.forEach((car, i) => {
    console.log(
      `  ${(i + 1).toString().padStart(3)}. ${car.name.padEnd(40)} (${car.year || "N/A"})`
    );
  });

  console.log("\n" + "=".repeat(60));
  console.log(`\n🚀 Generating ${PHOTOS_PER_CAR} photos per car (${cars.length * PHOTOS_PER_CAR} total)...\n`);

  let totalSuccessful = 0;
  let totalFailed = 0;
  const failedCars = [];

  for (let i = 0; i < cars.length; i++) {
    try {
      const result = await generateCarPhotos(cars[i], i + 1, cars.length);
      totalSuccessful += result.successful;
      totalFailed += result.failed;

      if (result.failed > 0) {
        failedCars.push(cars[i].name);
      }

      // Small delay between cars
      if (i < cars.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`  ✗ Error processing car: ${err.message}`);
      failedCars.push(cars[i].name);
      totalFailed += PHOTOS_PER_CAR;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Generation Summary:\n");
  console.log(`  ✓ Successful: ${totalSuccessful} photos`);
  console.log(`  ✗ Failed: ${totalFailed} photos`);
  console.log(`  🚗 Cars processed: ${cars.length - failedCars.length}/${cars.length}`);

  if (failedCars.length > 0) {
    console.log("\n  Cars with failures:");
    failedCars.forEach((car) => console.log(`    - ${car}`));
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

module.exports = { generateCarPhotos };
