import type { Screen02ContextLead } from "../../core/screen02-workflow-types";

export function contextLeadSearchLocator(
  lead: Pick<Screen02ContextLead, "title" | "publisher">,
) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${lead.title}" ${lead.publisher}`)}`;
}

export default function ContextLeads({
  leads,
  note,
}: {
  leads?: Screen02ContextLead[];
  note: string;
}) {
  if (!leads?.length) return null;
  return (
    <section aria-label="Context to verify">
      <h3>Context to verify</h3>
      <p>{note}</p>
      <ul>
        {leads.map((lead) => (
          <li key={lead.id}>
            <strong>{lead.title}</strong>
            <span>
              {lead.publisher}{lead.publishedDate ? ` · ${lead.publishedDate}` : ""}
              {" · Unverified secondary lead. "}
              <a
                href={contextLeadSearchLocator(lead)}
                target="_blank"
                rel="noreferrer"
              >Find this title</a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
