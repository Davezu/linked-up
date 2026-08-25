import { z } from "zod";

export const ClassifySchema = z.object({
    url: z.string().url("Invalid URL"),
});

export const LibraryItemSchema = z.object({
    url: z.string().url(),
    title: z.string().max(300),
    summary: z.string().max(1000),
    category: z.string().max(100),
    tags: z.array(z.string().max(50)).max(20).default([]),
});

export const NoteItemSchema = z.object({
    id: z.string().optional(),
    title: z.string().max(300),
    content: z.string().max(5000),
    folder: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(20).default([]),
});

export const ChatSchema = z.object({
    question: z.string().trim().min(1).max(500),
    library: z.array(LibraryItemSchema).max(100).default([]),
    notes: z.array(NoteItemSchema).max(100).default([]),
});