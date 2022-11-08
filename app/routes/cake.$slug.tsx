import { documentToPlainTextString } from '@contentful/rich-text-plain-text-renderer'
import { json, LoaderArgs, MetaFunction } from '@remix-run/cloudflare'
import { useLoaderData } from '@remix-run/react'
import { gql } from 'graphql-request'
import type { Product, WithContext } from 'schema-dts'
import CakeView from '~/components/cakeView'
import Layout from '~/layout'
import { cacheQuery, Cake, CAKE_DETAILS, DaysClosed } from '~/utils/contentful'
import { getAllPages } from '~/utils/kv'
import { LoaderData } from '~/utils/unwrapLoaderData'

export const loader = async ({ context, params, request }: LoaderArgs) => {
  const data = await cacheQuery<{
    cakeCollection: { items: Cake[] }
    daysClosedCollection: { items: DaysClosed[] }
  }>({
    ttlMinutes: 0,
    context,
    request,
    variables: { slug: params.slug, end_gte: new Date().toISOString() },
    query: gql`
      ${CAKE_DETAILS}
      query Cake($preview: Boolean, $slug: String!, $end_gte: DateTime!) {
        cakeCollection(preview: $preview, limit: 1, where: { slug: $slug }) {
          items {
            ...CakeDetails
          }
        }
        daysClosedCollection(preview: $preview, where: { end_gte: $end_gte }) {
          items {
            start
            end
          }
        }
      }
    `
  })

  if (!data?.cakeCollection?.items?.length || data.cakeCollection.items.length !== 1) {
    throw json('Not Found', { status: 404 })
  }

  const { navs } = await getAllPages(context)
  return json({
    navs,
    cake: data.cakeCollection.items[0],
    daysClosedCollection: data.daysClosedCollection.items
  })
}

export const meta: MetaFunction = ({ data }: { data: LoaderData<typeof loader> }) => ({
  title: `${data.cake.name} | Round&Round Rotterdam`,
  ...(data.cake.description && {
    description: documentToPlainTextString(data.cake.description.json).substring(0, 199)
  })
})
export const handle = {
  structuredData: (data: LoaderData<typeof loader>): WithContext<Product> => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.cake.name,
    image: data.cake.image?.url,
    offers: {
      '@type': 'Offer',
      price:
        (data.cake.typeCAvailable ? data.cake.typeCPrice : 0) ||
        (data.cake.typeBAvailable ? data.cake.typeBPrice : 0) ||
        (data.cake.typeAAvailable ? data.cake.typeAPrice : 0),
      priceCurrency: 'EUR'
    }
  })
}

const PageCake: React.FC = () => {
  const { navs, cake, daysClosedCollection } = useLoaderData<typeof loader>()

  return (
    <Layout
      navs={navs}
      children={<CakeView cake={cake} daysClosedCollection={daysClosedCollection} />}
    />
  )
}

export default PageCake
