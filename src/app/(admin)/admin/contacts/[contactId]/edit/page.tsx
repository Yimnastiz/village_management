import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function EditContactPage({ params }: PageProps) {
  const { contactId } = await params;
  // The detail screen owns the sole edit implementation. Keeping this redirect
  // preserves old bookmarks without leaving a second edit path to maintain.
  redirect(`/admin/contacts/${contactId}`);
}
