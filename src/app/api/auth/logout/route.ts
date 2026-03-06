import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
    const res = NextResponse.json({ success: true });
    res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        expires: new Date(0),
        path: "/",
    });
    return res;
}
