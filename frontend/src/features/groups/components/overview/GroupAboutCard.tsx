import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { Group } from "../../types/group";

export default function GroupAboutCard({ group }: { group: Group }) {
  return (
    <section className="group-panel group-about" aria-labelledby="about-heading">
      <div className="group-section-heading">
        <h2 id="about-heading">About</h2>
      </div>
      {group.description ? (
        <p className="group-about-description">{group.description}</p>
      ) : (
        <p className="group-muted">No description yet.</p>
      )}
      <dl className="group-about-facts">
        <div className="group-about-fact">
          <dt>Created by</dt>
          <dd>
            <Link
              href={`/profile/${encodeURIComponent(group.creatorUsername)}`}
              className="group-title-link"
            >
              @{group.creatorUsername}
            </Link>
          </dd>
        </div>
        {group.createdAt && (
          <div className="group-about-fact">
            <dt>Created on</dt>
            <dd>{formatDate(group.createdAt)}</dd>
          </div>
        )}
        <div className="group-about-fact">
          <dt>Group Privacy</dt>
          <dd>{group.privacy === "public" ? "Public" : "Private"}</dd>
        </div>
      </dl>
    </section>
  );
}
