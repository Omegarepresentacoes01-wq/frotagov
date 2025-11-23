import { GoogleGenAI } from "@google/genai";
import { Transaction, Vehicle } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateFleetInsights = async (transactions: Transaction[], vehicles: Vehicle[]): Promise<string> => {
  const ai = initAI();
  if (!ai) return "Chave de API não configurada. Impossível gerar insights.";

  const recentTxs = transactions.filter(t => t.status === 'VALIDATED' || t.status === 'INVOICED' || t.status === 'PAID').slice(-20);
  
  // anonymize/simplify data for token efficiency
  const dataSummary = {
    vehicles: vehicles.map(v => ({ model: v.model, plate: v.plate, targetAvg: v.avgConsumption })),
    transactions: recentTxs.map(t => ({
      vehicleId: t.vehicleId,
      liters: t.filledLiters,
      km: t.odometer,
      total: t.totalValue
    }))
  };

  const prompt = `
    Analise os seguintes dados de frota e transações recentes (JSON).
    Identifique:
    1. Qual veículo está com melhor eficiência (km/l estimado baseado no histórico, se houver dados suficientes de km consecutivos).
    2. Qual veículo teve maior gasto.
    3. Sugestão de economia.
    
    Seja breve, profissional e direto. Use formatação Markdown.
    Dados: ${JSON.stringify(dataSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Sem insights disponíveis no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar análise inteligente.";
  }
};