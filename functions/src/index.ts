import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { closeMonthlyStatements } from "./statements/closeMonthlyStatements";

initializeApp();

const db = getFirestore();

/**
 * Cron: day 3 of every month at 00:00 (America/Santiago).
 * Generates closed MonthlyStatement docs for all active users.
 */
export const closeMonthlyStatementsJob = onSchedule(
  {
    schedule: "0 0 3 * *",
    timeZone: "America/Santiago",
    region: "us-central1",
    retryCount: 3,
  },
  async () => {
    logger.info("Starting monthly statement close job");

    try {
      const result = await closeMonthlyStatements(db);

      logger.info("Monthly statement close job finished", result);

      if (result.failedUsers.length > 0) {
        logger.warn("Some users failed during statement close", {
          failedCount: result.failedUsers.length,
          failedUsers: result.failedUsers,
        });
      }
    } catch (error) {
      logger.error("Monthly statement close job aborted", error);
      throw error;
    }
  },
);
