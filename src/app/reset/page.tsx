import { Suspense } from "react";
import ResetClient from "./ResetClient";

export const metadata = {
    title: "Reset Password — Pin Drop",
};

export default function ResetPage() {
    return (
        <Suspense fallback={null}>
            <ResetClient />
        </Suspense>
    );
}
