import Anthropic from "@anthropic-ai/sdk";
import { supabase, getActivePrompt } from "./db.js";
import { fetchDvsaData } from "./fetchMotDataFromDvsa.js";

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { registration, userNotes = "" } = req.body;

    if (!registration) {
      return res.status(400).json({ error: "Registration required" });
    }

    const cleanReg = registration.trim().toUpperCase().replace(/\s+/g, "");

    // Fetch DVSA data
    const motDataResult = await fetchDvsaData(cleanReg);

    if (motDataResult.error) {
      return res
        .status(motDataResult.statusCode || 500)
        .json({ status: "error", error: motDataResult.error });
    }

    if (!motDataResult.motTests || motDataResult.motTests.length === 0) {
      return res.json({
        status: "no_mot_history",
        registration: cleanReg,
        vehicle: motDataResult.vehicle,
      });
    }

    // Get active prompt
    const activePrompt = await getActivePrompt();

    if (!activePrompt) {
      return res.status(500).json({
        status: "error",
        error: "No active MOT prompt configured",
      });
    }

    // Build analysis prompt
    const prompt = buildAnalysisPrompt(motDataResult, userNotes, activePrompt);

    // Call Claude
    let aiAnalysis;
    try {
      const message = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";
      aiAnalysis = JSON.parse(responseText);
    } catch (err) {
      console.error("AI analysis failed:", err.message);
      return res.json({
        status: "partial_success",
        registration: cleanReg,
        vehicle: motDataResult.vehicle,
        raw_mot_history: motDataResult.motTests,
        ai_analysis: null,
      });
    }

    return res.json({
      status: "success",
      registration: cleanReg,
      vehicle: motDataResult.vehicle,
      raw_mot_history: motDataResult.motTests,
      ai_analysis: aiAnalysis,
    });
  } catch (error) {
    console.error("analyzeMotHistory error:", error);
    return res.status(500).json({ status: "error", error: error.message });
  }
}

function buildAnalysisPrompt(motDataResult, userNotes = "", customPrompt) {
  const recentTests = motDataResult.motTests.slice(0, 3);
  const motSummary = {
    vehicle: `${motDataResult.vehicle.make} ${motDataResult.vehicle.model} (${motDataResult.vehicle.registration})`,
    age:
      new Date().getFullYear() -
      new Date(motDataResult.vehicle.firstUsedDate).getFullYear(),
    mileage: recentTests[0]?.odometerValue || 0,
    totalTests: motDataResult.motTests.length,
    passes: motDataResult.motTests.filter((t) => t.testResult === "PASSED")
      .length,
    fails: motDataResult.motTests.filter((t) => t.testResult === "FAILED")
      .length,
    recentDefects: recentTests
      .flatMap((t) => t.defects.map((d) => `${d.type}: ${d.text}`))
      .slice(0, 10),
  };

  const rawMotData = JSON.stringify(motSummary, null, 2);

  return `${customPrompt}

OUTPUT FORMAT

{
  "vehicle_summary": {
    "registration": "",
    "make": "",
    "model": "",
    "first_used_date": "",
    "fuel_type": "",
    "colour": ""
  },
  "mot_overview": {
    "total_tests": 0,
    "total_passes": 0,
    "total_failures": 0,
    "latest_mileage": 0,
    "mileage_consistency": "consistent | possible anomaly | insufficient data",
    "estimated_annual_mileage": 0
  },
  "maintenance_assessment": {
    "rating": "proactively maintained | mixed | neglected | insufficient data",
    "confidence": "high | medium | low",
    "reasoning": ""
  },
  "recurring_issues": [
    {
      "issue": "",
      "count": 0,
      "severity": "low | medium | high",
      "comment": ""
    }
  ],
  "timeline_insights": [""],
  "buyer_risks": [""],
  "positive_signs": [""],
  "market_value_estimate": {
    "private_sale_price_gbp": {"low": 0, "mid": 0, "high": 0},
    "dealer_sale_price_gbp": {"low": 0, "mid": 0, "high": 0},
    "trade_in_price_gbp": {"low": 0, "mid": 0, "high": 0}
  },
  "value_summary": "",
  "pricing_rationale": [""],
  "mot_value_adjustments": {
    "positive_factors": [],
    "negative_factors": [],
    "likely_near_term_cost_pressure": []
  },
  "rcie": {
    "risk": "LOW | MEDIUM | HIGH",
    "condition": "STRONG | AVERAGE | WEAK",
    "investability": "HIGH | MEDIUM | LOW",
    "exit_value": "STRONG | MODERATE | WEAK",
    "overall_recommendation": "STRONG BUY | BUY WITH CAUTION | PRICE SENSITIVE ONLY | AVOID UNLESS HEAVILY DISCOUNTED"
  },
  "buyer_note": "",
  "plain_english_summary": "",
  "disclaimer": "This assessment is based only on publicly available MOT history data and is not a substitute for a full mechanical inspection or professional valuation."
}

Here is the raw MOT data to analyze:
${rawMotData}

Additional user notes:
${userNotes || "None provided"}`;
}
