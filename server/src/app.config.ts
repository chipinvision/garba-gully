import {
  defineServer,
  defineRoom,
  monitor,
  matchMaker,
} from "colyseus";
import { tokenToRoomId } from "./tokenRegistry.js";
import { GarbaRoom } from "./rooms/GarbaRoom.js";

const server = defineServer({
  rooms: {
    garba_room: defineRoom(GarbaRoom),
  },

  express: (app) => {
    // CORS for development
    app.use((_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      next();
    });

    // CORS pre-flight — Express 5 requires named wildcard
    app.options("/{*path}", (_req, res) => { res.sendStatus(204); });


    /**
     * GET /api/rooms/resolve?token=xxx
     * Resolves an invite token to a live roomId.
     */
    app.get("/api/rooms/resolve", async (req, res) => {
      const token = req.query["token"] as string | undefined;
      if (!token) {
        return res.status(400).json({ error: "Missing token parameter" });
      }

      const roomId = tokenToRoomId.get(token);
      if (!roomId) {
        return res.status(404).json({ error: "Room not found or has ended" });
      }

      // Verify room still alive via matchMaker
      try {
        const rooms = await matchMaker.query({ roomId });
        if (rooms.length === 0) {
          tokenToRoomId.delete(token);
          return res.status(404).json({ error: "Room has ended" });
        }
      } catch {
        // matchMaker.query may throw — still try to join
      }

      return res.json({ roomId, token });
    });

    // Colyseus monitor (dev only)
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }
  },
});

export default server;
