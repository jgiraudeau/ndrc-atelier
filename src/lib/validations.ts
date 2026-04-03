import { z } from "zod";

export const studentLoginSchema = z.object({
    identifier: z.string().trim().min(1, "L'identifiant est requis").max(100),
    password: z.string().min(1, "Le mot de passe est requis").max(255),
});

export const teacherLoginSchema = z.object({
    email: z.string().trim().email("Email invalide").max(100),
    password: z.string().min(1, "Le mot de passe est requis").max(255),
});

export const progressUpdateSchema = z.object({
    competencyId: z.string().min(1, "L'ID de la compétence est requis").max(100),
    acquired: z.boolean({ 
        message: "Le statut d'acquisition est requis et doit être un booléen" 
    }),
    status: z.number().int().min(0).max(4),
    proof: z.string().max(2048).nullable().optional(),
});
