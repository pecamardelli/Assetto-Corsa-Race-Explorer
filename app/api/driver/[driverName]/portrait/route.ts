import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Import the portrait generation logic
const http = require('http');

const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;

type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
  isFictional?: boolean;
};

async function getDriverProfile(driverName: string): Promise<DriverProfile | null> {
  try {
    const profilePath = path.join(process.cwd(), 'app/lib/driver-profiles', `${driverName.replace(/ /g, '_').toLowerCase()}.json`);
    const fileContents = await fs.readFile(profilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return null;
  }
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function queuePrompt(workflow: any): Promise<any> {
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

    const req = http.request(options, (res: any) => {
      let body = "";
      res.on("data", (chunk: any) => (body += chunk));
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

function getHistory(promptId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: COMFYUI_HOST,
      port: COMFYUI_PORT,
      path: `/history/${promptId}`,
      method: "GET",
    };

    const req = http.request(options, (res: any) => {
      let body = "";
      res.on("data", (chunk: any) => (body += chunk));
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

function downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ filename, subfolder, type });

    const options = {
      hostname: COMFYUI_HOST,
      port: COMFYUI_PORT,
      path: `/view?${params.toString()}`,
      method: "GET",
    };

    const req = http.request(options, (res: any) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });

    req.on("error", reject);
    req.end();
  });
}

async function waitForCompletion(promptId: string, timeout = 300000): Promise<any> {
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

type PortraitOptions = {
  expression?: string;
  angle?: string;
  framing?: string;
  suit?: string;
  distance?: string;
};

function loadWorkflow(profile: DriverProfile, options: PortraitOptions = {}): any {
  const workflowPath = path.join(process.cwd(), 'scripts', 'comfyui-workflow.json');

  if (!require('fs').existsSync(workflowPath)) {
    throw new Error('ComfyUI workflow file not found');
  }

  const workflow = JSON.parse(require('fs').readFileSync(workflowPath, 'utf8'));

  const age = calculateAge(profile.dateOfBirth);
  const features = profile.features;
  const nationality = profile.nationality;
  const gender = profile.gender;

  // Expression mappings
  const expressionMap: Record<string, { expression: string; negatives: string }> = {
    'neutral': { expression: "neutral confident expression, closed mouth", negatives: "smile, grin, showing teeth, laughing, happy, smiling" },
    'slight-smile': { expression: "slight smile, subtle friendly smile, gentle smile, closed mouth smile", negatives: "wide grin, big smile, showing teeth, laughing, exaggerated expression" },
    'smile-teeth': { expression: "natural smile showing teeth, genuine smile with visible teeth, friendly smile with teeth", negatives: "wide grin, exaggerated laughing, mouth wide open, excessive teeth showing" },
    'serious': { expression: "serious intense expression, focused look, no smile", negatives: "smile, grin, happy, relaxed, cheerful, smiling, laughing" },
    'calm': { expression: "calm composed expression, slight smile, serene look", negatives: "wide grin, laughing, exaggerated happy, showing teeth" },
    'smirk': { expression: "slight smirk, subtle smirk, confident look with small smile", negatives: "wide grin, big smile, showing teeth, laughing, exaggerated expression" },
    'determined': { expression: "determined focused expression, no smile", negatives: "smile, grin, relaxed, casual, happy, smiling, laughing" },
    'stoic': { expression: "stoic professional expression, neutral face", negatives: "smile, grin, emotional, expressive, laughing, smiling, happy" },
    'approachable': { expression: "warm friendly smile, approachable smile, gentle pleasant smile", negatives: "wide grin, big smile, showing teeth, laughing, exaggerated expression" }
  };

  // Angle mappings
  const angleMap: Record<string, string> = {
    'front': "facing camera directly, front view",
    '45-degree': "body turned at 45 degree angle, head turned looking at camera",
    'slight-45': "slight 45 degree angle, shoulders turned, looking directly at camera",
    'three-quarter': "three-quarter view, body angled, face toward camera"
  };

  // Framing mappings
  const framingMap: Record<string, string> = {
    'upper-body': "upper body portrait showing torso and shoulders",
    'shoulders': "shoulders and up portrait",
    'torso': "torso visible, professional racing portrait",
    'face-focus': "face-focused portrait with minimal torso"
  };

  // Suit mappings
  const suitMap: Record<string, string> = {
    'red-white': "wearing red racing suit with white stripes",
    'blue-sponsors': "wearing blue racing suit with sponsor logos",
    'black-red': "wearing black racing suit with red accents",
    'white-blue': "wearing white racing suit with blue details",
    'green': "wearing green racing suit",
    'yellow-black': "wearing yellow and black racing suit",
    'navy-white': "wearing navy blue racing suit with white stripes",
    'orange': "wearing orange racing suit",
    'grey-black': "wearing grey racing suit with black details",
    'red-white-2': "wearing red and white racing suit",
    'black-yellow': "wearing black and yellow racing suit",
    'blue-white': "wearing blue and white racing suit"
  };

  // Distance mappings (camera distance, not framing)
  const distanceMap: Record<string, string> = {
    'medium': "camera at medium distance from subject",
    'close': "camera close to subject, intimate portrait distance",
    'slightly-far': "camera slightly far from subject, wider view"
  };

  // Select expression
  let selectedExpression;
  if (options.expression && options.expression !== 'random' && expressionMap[options.expression]) {
    selectedExpression = expressionMap[options.expression];
  } else {
    const expressions = Object.values(expressionMap);
    selectedExpression = expressions[Math.floor(Math.random() * expressions.length)];
  }

  // Select angle
  let selectedAngle;
  if (options.angle && options.angle !== 'random' && angleMap[options.angle]) {
    selectedAngle = angleMap[options.angle];
  } else {
    const angles = Object.values(angleMap);
    selectedAngle = angles[Math.floor(Math.random() * angles.length)];
  }

  // Select framing
  let selectedFraming;
  if (options.framing && options.framing !== 'random' && framingMap[options.framing]) {
    selectedFraming = framingMap[options.framing];
  } else {
    selectedFraming = "upper body portrait showing torso and shoulders";
  }

  // Select suit
  let selectedSuit;
  if (options.suit && options.suit !== 'random' && suitMap[options.suit]) {
    selectedSuit = suitMap[options.suit];
  } else {
    const suits = Object.values(suitMap);
    selectedSuit = suits[Math.floor(Math.random() * suits.length)];
  }

  // Select distance
  let selectedDistance;
  if (options.distance && options.distance !== 'random' && distanceMap[options.distance]) {
    selectedDistance = distanceMap[options.distance];
  } else {
    const distances = Object.values(distanceMap);
    selectedDistance = distances[Math.floor(Math.random() * distances.length)];
  }

  const positivePrompt = `realistic professional studio portrait photograph, ${nationality} racing driver, ${age} years old, ${gender}, ${features}, ${selectedSuit}, ${selectedAngle}, ${selectedFraming}, ${selectedDistance}, ${selectedExpression.expression}, looking directly at camera, centered in frame, fully visible in frame, head and body completely within image bounds, natural skin texture with pores and details, professional studio lighting, plain grey background, sharp focus on face, photorealistic, high detail, professional racing portrait`;

  const negativePrompt = `${selectedExpression.negatives}, exaggerated expression, fashion model pose, heavy makeup, racing helmet, hat, cap, sunglasses, goggles, glasses, extreme close-up, cropped face, cut off head, cut off torso, cut off body parts, out of frame, off-center, body parts outside frame, head cut off, partially visible, plastic skin, smooth skin, CGI, 3D render, illustration, drawing, painting, cartoon, anime, celebrity lookalike, famous person, multiple people, text, watermark, low quality, blurry`;

  // Find positive and negative prompt nodes
  let positivePromptNode = null;
  let negativePromptNode = null;

  for (const [nodeId, node] of Object.entries(workflow)) {
    if (
      (node as any).class_type === "CLIPTextEncode" &&
      (node as any).inputs &&
      (node as any).inputs.text !== undefined
    ) {
      const currentText = String((node as any).inputs.text).toLowerCase();
      const title = String((node as any)._meta?.title || "").toLowerCase();

      if (
        currentText.includes("negative") ||
        currentText.includes("bad quality") ||
        currentText.includes("low quality") ||
        currentText.includes("worst quality") ||
        title.includes("negative")
      ) {
        negativePromptNode = nodeId;
      } else if (!positivePromptNode) {
        positivePromptNode = nodeId;
      }
    }
  }

  if (!positivePromptNode || !negativePromptNode) {
    const clipNodes = Object.entries(workflow)
      .filter(([, node]) => (node as any).class_type === "CLIPTextEncode")
      .map(([id]) => id);

    if (clipNodes.length >= 2) {
      positivePromptNode = positivePromptNode || clipNodes[0];
      negativePromptNode = negativePromptNode || clipNodes[1];
    }
  }

  if (positivePromptNode && workflow[positivePromptNode]) {
    (workflow[positivePromptNode] as any).inputs.text = positivePrompt;
  }

  if (negativePromptNode && workflow[negativePromptNode]) {
    (workflow[negativePromptNode] as any).inputs.text = negativePrompt;
  }

  // Update seed for variation
  for (const [, node] of Object.entries(workflow)) {
    if (
      (node as any).class_type === "KSampler" &&
      (node as any).inputs &&
      (node as any).inputs.seed !== undefined
    ) {
      (node as any).inputs.seed = Math.floor(Math.random() * 1000000000);
    }
  }

  return workflow;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverName: string }> }
) {
  try {
    const { driverName } = await params;
    const decodedDriverName = decodeURIComponent(driverName);

    // Parse request body for options
    let options: PortraitOptions = {};
    try {
      const body = await request.json();
      options = {
        expression: body.expression,
        angle: body.angle,
        framing: body.framing,
        suit: body.suit,
        distance: body.distance,
      };
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Get driver profile
    const profile = await getDriverProfile(decodedDriverName);
    if (!profile) {
      return NextResponse.json(
        { error: 'Driver profile not found' },
        { status: 404 }
      );
    }

    // Check if ComfyUI workflow exists
    const workflowPath = path.join(process.cwd(), 'scripts', 'comfyui-workflow.json');
    try {
      await fs.access(workflowPath);
    } catch {
      return NextResponse.json(
        { error: 'ComfyUI workflow not configured. Please export your workflow as comfyui-workflow.json in the scripts folder.' },
        { status: 500 }
      );
    }

    // Load and customize workflow with options
    const workflow = loadWorkflow(profile, options);

    // Queue the prompt
    const result = await queuePrompt(workflow);
    const promptId = result.prompt_id;

    // Wait for completion
    const history = await waitForCompletion(promptId);

    // Find the output image
    const outputs = history.outputs;
    let imageData: Buffer | null = null;

    for (const [, output] of Object.entries(outputs)) {
      if ((output as any).images && (output as any).images.length > 0) {
        const image = (output as any).images[0];
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
    const outputPath = path.join(
      process.cwd(),
      'public',
      'driver-portraits',
      `${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`
    );

    await fs.writeFile(outputPath, imageData);

    return NextResponse.json({
      success: true,
      message: 'Portrait generated successfully',
      imagePath: `/driver-portraits/${decodedDriverName.replace(/ /g, '_').toLowerCase()}.png`
    });
  } catch (error) {
    console.error('Error generating portrait:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate portrait' },
      { status: 500 }
    );
  }
}
