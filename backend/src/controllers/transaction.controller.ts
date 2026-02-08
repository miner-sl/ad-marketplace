import {FastifyReply, FastifyRequest} from "fastify";
import {z} from "zod";
import {beginCell} from "@ton/core";
import {generateUserIDHash} from "../utils/verifyTonProof";
import {DealModel} from "../repositories/deal-model.repository";
import logger from "../utils/logger";

const contestTransactionCreateSchema = z.preprocess(
  (data: any) => {
    if (data.ton_proof && typeof data.ton_proof === 'string') {
      data.ton_proof = JSON.parse(data.ton_proof);
    }
    return data;
  },
  z.object({
    wallet: z.string().regex(/^(-?\d+):[0-9a-fA-F]{64}$/),
    wallet_initState: z.string(),
    ton_proof: z.object({
      name: z.string(),
      proof: z.object({
        timestamp: z.number(),
        domain: z.object({
          lengthBytes: z.number(),
          value: z.string(),
        }),
        payload: z.string(),
        signature: z.string(),
      }),
    }).optional(),
  }),
);

export class TransactionController {
  static async routeGETContestTonProofPayloadCreate(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user?.id;
    if (!userId) {
      reply.send({
        status: "error",
        error: "User not found"
      });
      return;
    }
    reply.send({
      status: "success",
      result: {
        payload: generateUserIDHash(userId),
      },
    });
  }

  static async createContestTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          status: "failed",
          error: "Unauthorized",
        });
      }

      const params = request.params as { dealId: string };
      const dealId = parseInt(params.dealId);

      if (!dealId || isNaN(dealId)) {
        return reply.code(400).send({
          status: "failed",
          error: "Valid deal ID is required",
        });
      }

      const validationResult = contestTransactionCreateSchema.safeParse(request.body);
      
      if (!validationResult.success) {
        return reply.code(400).send({
          status: "failed",
          error: "Validation failed",
          details: validationResult.error.errors,
        });
      }

      const deal = await DealModel.findById(dealId);

      if (!deal) {
        return reply.code(404).send({
          status: "failed",
          error: "Deal not found",
        });
      }

      const userHash = generateUserIDHash(userId);
      const dealIdentifier = `deal-${deal.id}-${userHash}`;

      const master = beginCell()
        .storeUint(0, 32)
        .storeStringTail(dealIdentifier)
        .endCell();

      const target = beginCell()
        .storeUint(0, 32)
        .storeStringTail(dealIdentifier)
        .endCell();

      return reply.send({
        status: "success",
        result: {
          payload: {
            master: master.toBoc().toString("base64"),
            target: target.toBoc().toString("base64"),
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to create deal transaction', {
        error: error.message,
        stack: error.stack,
        userId: request.user?.id,
        dealId: (request.params as { dealId: string })?.dealId,
      });

      return reply.code(500).send({
        status: "failed",
        error: "Internal server error",
      });
    }
  }
}
