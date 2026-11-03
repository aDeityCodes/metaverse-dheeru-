import { WebSocket } from "ws";
import { RoomManager } from "./RoomManager";
import { OutgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_PASSWORD } from "./config";

function getRandomString(length: number) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let result = "";

    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    return result;
}

export class User {
    public id: string;
    public userId?: string;

    private spaceId?: string;
    private x: number;
    private y: number;
    private ws: WebSocket;

    constructor(ws: WebSocket) {
        this.id = getRandomString(10);
        this.x = 0;
        this.y = 0;
        this.ws = ws;

        this.initHandlers();
    }

    initHandlers() {
        this.ws.on("message", async (data) => {
            try {
                console.log("Raw WebSocket message:", data.toString());

                const parsedData = JSON.parse(data.toString());

                console.log("Parsed WebSocket message:", parsedData);

                switch (parsedData.type) {
                    /* =====================================================
                       JOIN
                    ===================================================== */

                    case "join": {
                        try {
                            console.log("join received");

                            const spaceId =
                                parsedData.payload?.spaceId;

                            const token =
                                parsedData.payload?.token;

                            if (!spaceId || !token) {
                                console.log(
                                    "Missing spaceId or token"
                                );

                                this.send({
                                    type: "auth-error",
                                    payload: {
                                        message:
                                            "Missing spaceId or token",
                                    },
                                });

                                this.ws.close();

                                return;
                            }

                            /* =========================
                               VERIFY JWT
                            ========================= */

                            const decoded = jwt.verify(
                                token,
                                JWT_PASSWORD
                            ) as JwtPayload;

                            const userId = decoded.userId;

                            if (!userId) {
                                console.log(
                                    "JWT does not contain userId"
                                );

                                this.send({
                                    type: "auth-error",
                                    payload: {
                                        message:
                                            "Invalid authentication token",
                                    },
                                });

                                this.ws.close();

                                return;
                            }

                            this.userId = String(userId);

                            console.log(
                                "Authenticated user:",
                                this.userId
                            );

                            /* =========================
                               FIND SPACE
                            ========================= */

                            console.log(
                                "Looking for space:",
                                spaceId
                            );

                            let space =
                                await client.space.findUnique({
                                    where: {
                                        id: spaceId,
                                    },
                                });

                            /* =========================
                               CREATE DEFAULT SPACE
                            ========================= */

                            if (!space) {
                                console.log(
                                    "Space not found. Creating default space:",
                                    spaceId
                                );

                                space = await client.space.create({
                                    data: {
                                        id: spaceId,
                                        name: `Space ${spaceId}`,
                                        width: 40,
                                        height: 24,
                                        creator: {
                                            connect: {
                                                id: userId,
                                            },
                                        },
                                    },
                                });

                                console.log(
                                    "Default space created:",
                                    space.id
                                );
                            }

                            /* =========================
                               STORE SPACE
                            ========================= */

                            this.spaceId = space.id;

                            /* =========================
                               ADD USER TO ROOM
                            ========================= */

                            const roomManager =
                                RoomManager.getInstance();

                            roomManager.addUser(
                                space.id,
                                this
                            );

                            /* =========================
                               SPAWN PLAYER
                            ========================= */

                            this.x = Math.floor(
                                Math.random() *
                                space.width
                            );

                            this.y = Math.floor(
                                Math.random() *
                                space.height
                            );

                            /* =========================
                               GET OTHER PLAYERS
                            ========================= */

                            const users =
                                roomManager.rooms
                                    .get(space.id)
                                    ?.filter(
                                        (user) =>
                                            user.id !==
                                            this.id
                                    )
                                    .map((user) => ({
                                        userId:
                                            user.userId,
                                        x: user.x,
                                        y: user.y,
                                    })) ?? [];

                            /* =========================
                               TELL CLIENT JOIN SUCCEEDED
                            ========================= */

                            this.send({
                                type: "space-joined",

                                payload: {
                                    userId:
                                        this.userId,

                                    spawn: {
                                        x: this.x,
                                        y: this.y,
                                    },

                                    users,
                                },
                            });

                            console.log(
                                "space-joined sent successfully"
                            );

                            /* =========================
                               INFORM OTHER PLAYERS
                            ========================= */

                            roomManager.broadcast(
                                {
                                    type: "user-joined",

                                    payload: {
                                        userId:
                                            this.userId,
                                        x: this.x,
                                        y: this.y,
                                    },
                                },
                                this,
                                this.spaceId
                            );

                            break;
                        } catch (error) {
                            console.error(
                                "JOIN ERROR:",
                                error
                            );

                            try {
                                this.send({
                                    type: "auth-error",
                                    payload: {
                                        message:
                                            "Unable to join the game.",
                                    },
                                });
                            } catch {
                                // Socket may already be closed.
                            }

                            this.ws.close();
                        }

                        break;
                    }

                    /* =====================================================
                       MOVE
                    ===================================================== */

                    case "move": {
                        if (
                            !this.userId ||
                            !this.spaceId
                        ) {
                            return;
                        }

                        const moveX =
                            parsedData.payload?.x;

                        const moveY =
                            parsedData.payload?.y;

                        if (
                            typeof moveX !== "number" ||
                            typeof moveY !== "number"
                        ) {
                            return;
                        }

                        const xDisplacement =
                            Math.abs(
                                this.x - moveX
                            );

                        const yDisplacement =
                            Math.abs(
                                this.y - moveY
                            );

                        const validMove =
                            (xDisplacement === 1 &&
                                yDisplacement === 0) ||
                            (xDisplacement === 0 &&
                                yDisplacement === 1);

                        if (validMove) {
                            this.x = moveX;
                            this.y = moveY;

                            RoomManager.getInstance().broadcast(
                                {
                                    type: "movement",

                                    payload: {
                                        userId:
                                            this.userId,
                                        x: this.x,
                                        y: this.y,
                                    },
                                },
                                this,
                                this.spaceId
                            );

                            return;
                        }

                        this.send({
                            type: "movement-rejected",

                            payload: {
                                x: this.x,
                                y: this.y,
                            },
                        });

                        break;
                    }

                    /* =====================================================
                       CHAT
                    ===================================================== */

                    case "chat": {
                        if (
                            !this.userId ||
                            !this.spaceId
                        ) {
                            return;
                        }

                        const text =
                            parsedData.payload
                                ?.text ??
                            parsedData.payload
                                ?.message;

                        if (
                            typeof text !== "string" ||
                            !text.trim()
                        ) {
                            return;
                        }

                        RoomManager.getInstance().broadcast(
                            {
                                type: "chat",

                                payload: {
                                    userId:
                                        this.userId,
                                    username:
                                        parsedData
                                            .payload
                                            ?.username ??
                                        "Player",
                                    text: text.trim(),
                                },
                            },
                            this,
                            this.spaceId
                        );

                        break;
                    }

                    default: {
                        console.log(
                            "Unknown WebSocket message type:",
                            parsedData.type
                        );

                        break;
                    }
                }
            } catch (error) {
                console.error(
                    "WebSocket message handler error:",
                    error
                );
            }
        });

        this.ws.on("close", () => {
            console.log(
                "WebSocket connection closed:",
                this.userId
            );

            this.destroy();
        });

        this.ws.on("error", (error) => {
            console.error(
                "WebSocket error:",
                error
            );
        });
    }

    destroy() {
        if (!this.spaceId) {
            return;
        }

        const roomManager =
            RoomManager.getInstance();

        roomManager.broadcast(
            {
                type: "user-left",

                payload: {
                    userId: this.userId,
                },
            },
            this,
            this.spaceId
        );

        roomManager.removeUser(
            this,
            this.spaceId
        );

        console.log(
            "User removed from space:",
            this.userId,
            this.spaceId
        );

        this.spaceId = undefined;
    }

    send(payload: OutgoingMessage) {
        if (
            this.ws.readyState ===
            WebSocket.OPEN
        ) {
            this.ws.send(
                JSON.stringify(payload)
            );
        }
    }
}