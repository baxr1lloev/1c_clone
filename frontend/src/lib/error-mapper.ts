import { AxiosError } from "axios";

interface ErrorResponse {
    title: string;
    description: string;
}

export function mapApiError(error: any): ErrorResponse {
    // Default Fallback
    const result: ErrorResponse = {
        title: "Operation Failed",
        description: "An unexpected system error occurred."
    };

    if (!error?.response) {
        if (error?.message === "Network Error") {
            result.title = "Connection Lost";
            result.description = "Please check your internet connection.";
        }
        return result;
    }

    const status = error.response.status;
    const data = error.response.data;

    // 1. Status Code Mapping (The "Why")
    switch (status) {
        case 500:
            result.title = "Document Not Posted";
            result.description = "Internal inconsistency detected. Please check stock levels and account balances.";
            return result;
        case 403:
            result.title = "Access Denied";
            result.description = "You do not have permission to perform this action.";
            return result;
        case 404:
            result.title = "Data Missing";
            result.description = "The referenced document or object was not found (it may have been deleted).";
            return result;
        case 400:
            result.title = "Validation Error";

            // 2. Field Error Parsing (The "What")
            // DRF returns { field: ["error"] } or ["Global error"]
            if (typeof data === 'object' && data !== null) {
                const errors: string[] = [];

                Object.entries(data).forEach(([key, messages]) => {
                    const msg = Array.isArray(messages) ? messages[0] : String(messages);

                    if (key === 'non_field_errors' || key === 'detail') {
                        errors.push(msg);
                    } else if (key === 'lines' && Array.isArray(messages)) {
                        // Handle nested line errors if array (bulk serializers sometimes return arrays)
                        // Or if it's an object of errors
                        // Simplified handling for common 1C cases:
                        errors.push(`Error in document lines: ${msg}`);
                    } else {
                        // Readable Field Names
                        const fieldName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                        errors.push(`${fieldName}: ${msg}`);
                    }
                });

                if (errors.length > 0) {
                    // Start with the first error for clarity, listed others if multiple
                    result.description = errors[0];
                    if (errors.length > 1) {
                        result.description += ` (+${errors.length - 1} more errors)`;
                    }
                } else {
                    result.description = "Please check all required fields.";
                }
            }
            return result;
    }

    return result;
}
