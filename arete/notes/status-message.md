Subject: Member profiles — where we've got to

The member profiles and the directory are working again. There's a clean-up
underneath that I'd rather do properly than quickly, so I want to explain what
it is and why it's a few days rather than an afternoon.

**What was actually wrong**

Two things were built at different times and never properly introduced to each
other: the 193 member profiles we imported from the spreadsheet, and the
profiles the site creates by itself when someone logs in for the first time.

The result was that a lot of members effectively had two identities on the
site, and the page addresses didn't line up with them. A member's profile lived
at one web address while the directory linked to a different one — so clicking
their name gave a "page not found". A handful had two profile records instead
of one. And because nothing connected a person's login to their imported
profile, the site couldn't reliably tell which record belonged to whom.

That's why it looked like several separate bugs. It was really one underlying
mismatch showing up in different places.

**What's fixed**

The links, the profile pages and the directory all resolve correctly now,
without renaming anything — so the existing links we've shared still work. The
duplicate-creation problem is stopped at source.

**What's left, and why it takes a little time**

The remaining work needs the one thing the system currently has no record of:
each member's email address on their profile. That's the link between "this
person logged in" and "this is their profile". Once it's in place, three things
follow automatically — members claim their imported profile instead of creating
a duplicate, their events show on their profile, and site access can be tied
to the approved member list.

Filling that in across 193 records is careful work rather than hard work. Names
in the spreadsheet don't always match the site exactly — accents, initials,
extra spaces, a couple of people with the same name — so it gets checked before
anything is written, not after. Getting it wrong would attach someone's profile
to the wrong person's login, which is the one mistake genuinely worth avoiding
on a private members' site.

There's also a small number of records needing a human decision — duplicates to
merge, a few profiles with no page at all — which I'll bring to you as a list
rather than guess at.
