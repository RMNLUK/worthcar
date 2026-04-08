export async function fetchDvsaData(cleanReg) {
  try {
    const CLIENT_ID = process.env.MOT_CLIENT_ID;
    const CLIENT_SECRET = process.env.MOT_CLIENT_SECRET;
    const SCOPE_URL = process.env.MOT_SCOPE_URL;
    const TOKEN_URL = process.env.MOT_TOKEN_URL;
    const API_KEY = process.env.MOT_API_KEY;
    const MOT_API_BASE_URL = "https://history.mot.api.gov.uk";

    if (!CLIENT_ID || !CLIENT_SECRET || !SCOPE_URL || !TOKEN_URL || !API_KEY) {
      return { error: "DVSA API secrets not configured" };
    }

    const scope = SCOPE_URL.endsWith("/.default") ? SCOPE_URL : `${SCOPE_URL}/.default`;
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: scope,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      return { error: "Failed to authenticate with DVSA API" };
    }

    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;

    const formattedReg = cleanReg.replace(/^([A-Z]{2})(\d{2})([A-Z]{3})$/, "$1$2 $3");
    const motUrl = `${MOT_API_BASE_URL}/v1/trade/vehicles/registration/${formattedReg}`;

    const motHistoryResponse = await fetch(motUrl, {
      headers: {
        "x-api-key": API_KEY,
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    });

    if (!motHistoryResponse.ok) {
      if (motHistoryResponse.status === 404) {
        return { error: "Vehicle registration not found" };
      }
      return { error: "DVSA API error" };
    }

    const dvsaData = await motHistoryResponse.json();

    if (!dvsaData.motTests || dvsaData.motTests.length === 0) {
      return {
        vehicle: {
          registration: dvsaData.registration,
          make: dvsaData.make,
          model: dvsaData.model,
          fuelType: dvsaData.fuelType,
          colour: dvsaData.primaryColour,
          firstUsedDate: dvsaData.firstUsedDate,
        },
        motTests: [],
      };
    }

    const vehicleDetails = {
      registration: dvsaData.registration,
      make: dvsaData.make,
      model: dvsaData.model,
      fuelType: dvsaData.fuelType,
      colour: dvsaData.primaryColour,
      firstUsedDate: dvsaData.firstUsedDate,
      motExpiryDate: dvsaData.motTests[0]?.expiryDate || null,
    };

    const motTests = dvsaData.motTests.map((test) => ({
      completedDate: test.completedDate,
      testResult: test.testResult,
      odometerValue: test.odometerValue,
      odometerUnit: test.odometerUnit === "MI" ? "mi" : "km",
      defects: (test.defects || []).map((item) => ({
        text: item.text,
        type: item.type === "DANGEROUS" ? "dangerous" : (item.type || "").toLowerCase(),
      })),
      expiryDate: test.expiryDate,
    }));

    return { vehicle: vehicleDetails, motTests };
  } catch (error) {
    console.error("DVSA fetch error:", error);
    return { error: error.message };
  }
}
