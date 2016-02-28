from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect
from django.core.exceptions import PermissionDenied
from django.core.servers.basehttp import FileWrapper
from django.core.urlresolvers import reverse
from designsafe.apps.djangoRT import rtUtil, forms, rtModels
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
import logging
import mimetypes
import pytz

logger = logging.getLogger(__name__)


def index(request):
    if request.user.is_authenticated():
        return HttpResponseRedirect(reverse('djangoRT:mytickets'))
    return HttpResponseRedirect(reverse('djangoRT:ticketcreate'))

@login_required
def mytickets(request):
    rt = rtUtil.DjangoRt()
    show_resolved = 'show_resolved' in request.GET
    tickets = rt.getUserTickets(request.user.email, show_resolved=show_resolved)
    return render(request, 'djangoRT/ticketList.html', { 'tickets': tickets, 'show_resolved': show_resolved })

@login_required
def ticketdetail(request, ticketId):
    rt = rtUtil.DjangoRt()

    if not rt.hasAccess(ticketId, request.user.email):
        raise PermissionDenied

    ticket = rt.getTicket(ticketId)
    ticket_history = rt.getTicketHistory(ticketId)

    for history in ticket_history:
        # remove bogus "untitled" attachments
        history['Attachments'] = filter(lambda a: not a[1].startswith('untitled ('),
                                        history['Attachments'])

    return render(request, 'djangoRT/ticketDetail.html', {
        'ticket': ticket,
        'ticket_history': ticket_history,
        'ticket_id': ticketId
    })


def ticketcreate(request):
    rt = rtUtil.DjangoRt()

    template_name = 'djangoRT/ticketCreate.html'
    if request.user.is_authenticated():
        form_cls = forms.TicketForm
    else:
        form_cls = forms.TicketGuestForm

    if request.method == 'POST':
        form = form_cls(request.POST, request.FILES)

        if form.is_valid():
            requestor_meta = '%s %s <%s>' % (
                form.cleaned_data['first_name'],
                form.cleaned_data['last_name'],
                form.cleaned_data['email'])

            meta = (
                ('Opened by', request.user),
                ('Category', dict(settings.TICKET_CATEGORIES)[form.cleaned_data['category']]),
                ('Resource', 'DesignSafe'),
            )

            header = '\n'.join('[%s] %s' % m for m in meta)
            ticket_body = '%s\n\n%s\n\n---\n%s' % (
                header,
                form.cleaned_data['problem_description'],
                requestor_meta
            )

            ticket = rtModels.Ticket(subject=form.cleaned_data['subject'],
                                     problem_description=ticket_body,
                                     requestor=form.cleaned_data['email'],
                                     cc=form.cleaned_data.get('cc', ''))

            logger.debug('Creating ticket for user: %s' % form.cleaned_data)

            ticket_id = rt.createTicket(ticket)
            if ticket_id > -1:
                messages.success(request, 'Your ticket has been submitted.')
                if 'attachment' in request.FILES:
                    rt.replyToTicket(
                        ticket_id,
                        files=([request.FILES['attachment'].name,
                                request.FILES['attachment'],
                                mimetypes.guess_type(request.FILES['attachment'].name)],
                               ))

                if request.user.is_authenticated:
                    return HttpResponseRedirect(reverse('djangoRT:ticketdetail',
                                                        args=[ticket_id]))
                else:
                    return HttpResponseRedirect(reverse('djangoRT:ticketcreate'))
            else:
                messages.error(
                    request, 'There was an error creating your ticket. Please try again.')
        else:
            messages.error(request, 'You ticket is missing some information. '
                                    'Please see below for details.')
    else:
        initial_data = {}
        if request.user.is_authenticated():
            initial_data = {
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name
            }
        form = form_cls(initial=initial_data)
    return render(request, template_name, {'form': form})

@login_required
def ticketreply(request, ticketId):
    rt = rtUtil.DjangoRt()

    if not rt.hasAccess(ticketId, request.user.email):
        raise PermissionDenied

    ticket = rt.getTicket(ticketId)
    data = {}

    if request.method == 'POST':
        form = forms.ReplyForm(request.POST, request.FILES)

        if form.is_valid():
            if 'attachment' in request.FILES:
                if rt.replyToTicket(ticketId, text=form.cleaned_data['reply'], files=([request.FILES['attachment'].name, request.FILES['attachment'], mimetypes.guess_type(request.FILES['attachment'].name)],)):
                    return HttpResponseRedirect(reverse( 'djangoRT:ticketdetail', args=[ ticketId ] ) )
                else:
                    data['reply'] = form.cleaned_data['reply']
                    form = forms.ReplyForm(data)
            else:
                if rt.replyToTicket(ticketId, text=form.cleaned_data['reply']):
                    return HttpResponseRedirect(reverse( 'djangoRT:ticketdetail', args=[ ticketId ] ) )
                else:
                    data['reply'] = form.cleaned_data['reply']
                    form = forms.ReplyForm(data)

    else:
        form = forms.ReplyForm(initial=data)
    return render(request, 'djangoRT/ticketReply.html', {
        'ticket_id': ticketId,
        'ticket': ticket,
        'form': form
    })

@login_required
def ticketclose(request, ticketId):
    rt = rtUtil.DjangoRt()

    if not rt.hasAccess(ticketId, request.user.email):
        raise PermissionDenied

    ticket = rt.getTicket(ticketId)
    data = {}

    if request.method == 'POST':
        form = forms.CloseForm(request.POST)
        if form.is_valid():
            if (rt.commentOnTicket(ticketId, text=form.cleaned_data['reply']) and
                    rt.closeTicket(ticketId)):
                return HttpResponseRedirect(reverse('djangoRT:ticketdetail',
                                                    args=[ticketId]))
    else:
        form = forms.CloseForm(initial=data)
    return render(request, 'djangoRT/ticketClose.html', {
        'ticket_id': ticketId,
        'ticket': ticket,
        'form': form
    })


@login_required
def ticketattachment(request, ticketId, attachmentId):
    title, attachment = rtUtil.DjangoRt().getAttachment(ticketId, attachmentId)
    if attachment['Headers']['Content-Disposition'] == 'inline':
        return render(request, 'djangoRT/attachment.html', {'attachment' : attachment['Content'], 'ticketId' : ticketId, 'title' : title});
    else:
        response = HttpResponse(attachment['Content'], content_type=attachment['Headers']['Content-Type'])
        response['Content-Disposition'] = attachment['Headers']['Content-Disposition']
        return response