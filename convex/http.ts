import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Convex Auth's HTTP routes (sign-in callbacks, etc.). Later phases add the
// Google OAuth and Twilio webhook routes here too.
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
