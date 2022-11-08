import classNames from 'classnames'
import { addDays, addMonths, formatISO, isAfter, isBefore, isEqual, parseISO } from 'date-fns'
import { useContext, useEffect, useRef, useState } from 'react'
import { DayPickerSingleProps } from 'react-day-picker'
import { BagContext } from '~/states/bag'
import { Cake, DaysClosed, DeliveryCustomization } from '~/utils/contentful'
import Button from './button'
import PickDay, { closedDays } from './pickDay'
import Select from './select'

type Props = {
  cake: Cake
  daysClosedCollection: DaysClosed[]
}

const CakeOrder: React.FC<Props> = ({ cake, daysClosedCollection }) => {
  const { cakeAdd, cakeCheck } = useContext(BagContext)
  const [amounts, setAmounts] = useState<{
    typeAAmount: string
    typeBAmount: string
    typeCAmount: string
  }>({ typeAAmount: '', typeBAmount: '', typeCAmount: '' })

  const [cakeCustomizations, setCakeCustomizations] = useState<[string, number][]>([])

  const needDeliveryOptions = useRef(cake.shippingAvailable)

  const [delivery, setDelivery] = useState<'pickup' | 'shipping' | ''>('')
  const [deliveryDate, setDeliveryDate] = useState<Date>()

  // Temp solution
  const [deliveryMinimum, setDeliveryMinimum] = useState<number>()
  useEffect(() => {
    if (needDeliveryOptions.current) {
      let tempMin
      switch (delivery) {
        case 'pickup':
          tempMin = cake.deliveryCustomizations?.pickup?.minimum
          break
        case 'shipping':
          tempMin = cake.deliveryCustomizations?.shipping?.minimum

          break
      }
      setDeliveryMinimum(tempMin)
      if (tempMin) {
        setAmounts({
          typeAAmount: parseInt(amounts.typeAAmount) < tempMin ? '' : amounts.typeAAmount,
          typeBAmount: parseInt(amounts.typeBAmount) < tempMin ? '' : amounts.typeBAmount,
          typeCAmount: parseInt(amounts.typeCAmount) < tempMin ? '' : amounts.typeCAmount
        })
      }
    }
  }, [delivery])

  const added = cakeCheck({
    ...cake,
    chosen: { delivery: delivery === '' ? undefined : { type: delivery } }
  })
  useEffect(() => {
    if (added) {
      if (added.chosen.cakeCustomizations?.length) {
        setCakeCustomizations(added.chosen.cakeCustomizations)
      }
      setAmounts({
        ...amounts,
        ...(added.chosen.typeAAmount && {
          typeAAmount: added.chosen.typeAAmount.toString()
        }),
        ...(added.chosen.typeBAmount && {
          typeBAmount: added.chosen.typeBAmount.toString()
        }),
        ...(added.chosen.typeCAmount && {
          typeCAmount: added.chosen.typeCAmount.toString()
        })
      })
      new Array('pickup', 'shipping').forEach(type => {
        if (added.chosen.delivery?.type === type) {
          setDelivery(type)
          if (added.chosen.delivery.date) {
            setDeliveryDate(parseISO(added.chosen.delivery.date))
          }
        }
      })
    }
  }, [])

  const renderDeliveryOptions = () => {
    if (needDeliveryOptions.current) {
      return (
        <Select
          name='delivery'
          value={delivery}
          required
          onChange={e => {
            if (e.target.value === 'pickup' || e.target.value === 'shipping') {
              setDelivery(e.target.value)
              setDeliveryDate(undefined)
            }
          }}
        >
          <option value='' children='Pickup / Delivery ...' disabled />
          <option value='pickup' children='Pickup in store' />
          <option value='shipping' children='Shipping in NL (PostNL)' />
        </Select>
      )
    }
  }
  const renderDeliveryDates = () => {
    if (delivery === '') return
    const availability = cake.deliveryCustomizations?.[delivery]?.availability

    if (availability) {
      const renderAvailability = (
        availability: DeliveryCustomization
      ): Omit<
        DayPickerSingleProps,
        'date' | 'setDate' | 'mode' | 'select' | 'onSelect' | 'onDayClick'
      > => {
        const maxLimit =
          parseInt(
            new Date().toLocaleString('nl-NL', {
              timeZone: 'Europe/Amsterdam',
              hour: '2-digit',
              hour12: false
            })
          ) > 16
            ? addDays(new Date(), 3)
            : addDays(new Date(), 2)

        let startingDate: Date
        let endingDate: Date
        if (Array.isArray(availability)) {
          const getStillAvailable = availability
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .filter(({ before }) => (before ? isBefore(new Date(), parseISO(before)) : true))[0]
            ?.date as string | undefined
          endingDate = parseISO(availability.sort((a, b) => (a.date > b.date ? -1 : 1))[0].date)
          if (!getStillAvailable) {
            return {
              defaultMonth: endingDate,
              fromMonth: endingDate,
              toMonth: endingDate,
              disabled: { after: new Date(2000, 1, 1) }
            }
          }
          startingDate = parseISO(getStillAvailable)
        } else {
          startingDate = availability.after ? parseISO(availability.after) : addDays(new Date(), 2)
          endingDate = availability.before
            ? parseISO(availability.before)
            : addMonths(new Date(), 1)
        }

        return {
          defaultMonth: startingDate,
          fromMonth: startingDate,
          toMonth: endingDate,
          disabled: [
            ...closedDays(daysClosedCollection),
            ...(Array.isArray(availability)
              ? [
                  (date: Date) =>
                    availability.filter(
                      a =>
                        (a.before ? isBefore(new Date(), parseISO(a.before)) : true) &&
                        isEqual(parseISO(a.date), date)
                    ).length <= 0
                ]
              : [
                  { before: isAfter(maxLimit, startingDate) ? maxLimit : startingDate },
                  { after: endingDate }
                ])
          ]
        }
      }

      return (
        <PickDay
          date={deliveryDate}
          setDate={setDeliveryDate}
          required
          {...renderAvailability(availability)}
        />
      )
    }
  }

  const renderCakeCustomizations = () => {
    return cake.cakeCustomizationsCollection?.items.map((customization, index) => {
      const customizationSelected = cakeCustomizations.filter(c => c[0] === customization.type)
      return (
        <Select
          key={index}
          required
          name={customization.type}
          value={customizationSelected.length === 1 ? customizationSelected[0][1] : ''}
          onChange={e => {
            if (customizationSelected.length === 1) {
              setCakeCustomizations(
                cakeCustomizations.map(c =>
                  c[0] === customization.type ? [c[0], parseInt(e.target.value)] : c
                )
              )
            } else {
              setCakeCustomizations([
                ...cakeCustomizations,
                [customization.type, parseInt(e.target.value)]
              ])
            }
          }}
        >
          <option value='' children={`${customization.type} ...`} disabled />
          {customization.options.map((option, index) => (
            <option key={index} value={index} children={option} />
          ))}
        </Select>
      )
    })
  }

  const renderTypeOptions = (type: 'A' | 'B' | 'C') => {
    const available = cake[`type${type}Available`]
    const unit = cake[`type${type}Unit`]?.unit
    const stock = cake[`type${type}Stock`]

    const stockDefined = stock !== (undefined || null)

    if (!available) return
    if (stockDefined && stock === 0) {
      return (
        <Select name={unit} value='' required={false} className='text-gray-400' disabled>
          <option value='' children='Sold out' disabled />
        </Select>
      )
    }

    const amount = amounts[`type${type}Amount`]
    const price = cake[`type${type}Price`]
    const minimum = cake[`type${type}Minimum`]

    if (price && unit) {
      return (
        <>
          <Select
            name={unit}
            value={amount}
            required={
              amounts.typeAAmount.length === 0 &&
              amounts.typeBAmount.length === 0 &&
              amounts.typeCAmount.length === 0
            }
            onChange={e =>
              e.target.value &&
              setAmounts({
                ...amounts,
                [`type${type}Amount`]: e.target.value
              })
            }
            className={amounts[`type${type}Amount`].length ? undefined : 'text-gray-400'}
          >
            <option
              value=''
              children={stockDefined ? `${stock} \u00d7 ${unit} left ...` : `${unit} ...`}
              disabled
            />
            {Array(stockDefined ? (stock || 0) + 1 : 16)
              .fill(undefined)
              .map((_, index) =>
                (deliveryMinimum || 1) <= index && (minimum || 1) <= index ? (
                  <option
                    key={index}
                    value={index}
                    children={index === 0 ? unit : `${index} \u00d7 ${unit}`}
                  />
                ) : null
              )}
          </Select>
        </>
      )
    }
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = e => {
    e.preventDefault()

    if (amounts.typeAAmount.length || amounts.typeBAmount.length || amounts.typeCAmount.length) {
      cakeAdd({
        ...cake,
        chosen: {
          ...(cakeCustomizations.length && { cakeCustomizations }),
          ...(amounts.typeAAmount.length && {
            typeAAmount: parseInt(amounts.typeAAmount)
          }),
          ...(amounts.typeBAmount.length && {
            typeBAmount: parseInt(amounts.typeBAmount)
          }),
          ...(amounts.typeCAmount.length && {
            typeCAmount: parseInt(amounts.typeCAmount)
          }),
          ...(needDeliveryOptions.current &&
            delivery !== '' && {
              delivery: {
                type: delivery,
                date: deliveryDate ? formatISO(deliveryDate) : undefined
              }
            })
        }
      })
    }
  }

  return (
    <form className='flex flex-col gap-4 mt-4' onSubmit={handleSubmit}>
      {needDeliveryOptions.current ? (
        <div>
          <div className='font-bold mb-2'>Delivery option</div>
          <div
            className={classNames(
              'grid gap-4',
              cake.deliveryCustomizations?.pickup || cake.deliveryCustomizations?.shipping
                ? 'grid-cols-2'
                : 'grid-cols-1'
            )}
          >
            {renderDeliveryOptions()}
            {renderDeliveryDates()}
          </div>
        </div>
      ) : null}
      {cake.cakeCustomizationsCollection?.items.length ? (
        <div className='flex flex-col gap-2'>
          <div className='font-bold'>Customizations</div>
          <div className='flex flex-row gap-4'>{renderCakeCustomizations()}</div>
        </div>
      ) : null}
      <div className='flex flex-col gap-2'>
        <div className='font-bold'>Quantity</div>
        <div className='flex flex-col lg:flex-row gap-4'>
          {renderTypeOptions('A')}
          {renderTypeOptions('B')}
          {renderTypeOptions('C')}
        </div>
      </div>
      <Button type='submit'>{added ? 'Update bag' : 'Add to bag'}</Button>
    </form>
  )
}

export default CakeOrder
