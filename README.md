# Connekted mockup

Clickable mockup of the redesigned Connekted product: 17 screens (Home, Setup, Inbox, Agents, Agent page, Live call, Campaigns, Campaign builder, Automations, Contacts, Contact after a call, Companies, Deals, Calls review, Reports, Settings, Phone numbers).

It is a plain static website: no build step, no dependencies.

## Put it online

**Vercel**
```
cd connekted-mockup
npx vercel deploy --prod
```
(Log in when asked. Framework: Other. No build command. Output directory: `.`)

**Netlify**: drag this folder onto https://app.netlify.com/drop

**GitHub Pages**: push the folder to a repo, then Settings › Pages › Deploy from branch.

## Run it locally
It must be served over http (opening index.html directly will not load the screens):
```
cd connekted-mockup
python3 -m http.server 8000
```
Then open http://localhost:8000

## Editing
Each screen is one file in `screens/`. Shared styles are in `app.css`. Text and styles are plain HTML; the data for lists (calls, agents, steps) is in the script at the bottom of each file. Names, numbers and call content are examples.
