# Shop Page

The courses store page displaying membership plans and course catalogs.

## Route

`/shop` - Accessible at `http://localhost:3000/shop`

## Components

- **PlanCard** - Displays membership plan cards with features, pricing, and CTA
- **CourseCard** - Displays individual course cards with badges, icons, and purchase buttons

## Features

- RTL Hebrew layout
- Responsive design (mobile, tablet, desktop)
- Tab-based catalog filtering (middle school / high school)
- Reuses shadcn/ui Card components
- Uses global CSS color variables

## Updating the Header Navigation

To make the "courses" link in the header point to this shop page:

1. Start the dev server: `pnpm dev`
2. Navigate to the admin panel: `http://localhost:3000/admin`
3. Log in with your admin credentials
4. Go to **Globals** → **Header** in the sidebar
5. Find the "courses" navigation item in the **Nav Items** array
6. Update the link to:
   - **Type**: `custom`
   - **URL**: `/shop`
   - **Label**: Keep as "courses" or change to "shop" (translations will handle display)
7. Click **Save** at the top right

The header will automatically revalidate and the link will now point to `/shop`.

## Future Enhancements

- Connect to actual course and membership data from Payload collections
- Add payment integration
- Add authentication checks for purchase buttons
- Add analytics tracking for plan/course selections
